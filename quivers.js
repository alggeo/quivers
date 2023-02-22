class Quiver {
    constructor(vertices, arrows) {

        // Check input
        this.vertexDict = {};
        this.vertexLabels = [];
        this.vertices = [];
        this.arrows = [];

        const unorderedVertices = [];
        if (vertices instanceof Array) {
            unorderedVertices.push(...vertices);
        }
        if (typeof vertices === 'string') {
            let i = 0;
            for (const match of vertices.matchAll(/[^, ;]+/g)) {
                unorderedVertices.push(i);
                if (this.vertexDict[match[0]]) {
                    throw new Error('duplicate vertex name detected');
                }
                this.vertexDict[match[0]] = i;
                i++;
            }
        }

        const unorderedArrows = [];
        if (arrows instanceof Array) {
            arrows.forEach(arrow => {
                if (arrow instanceof Array || arrow.length === 2) {
                    if (vertices.includes(arrow[0]) && vertices.includes(arrow[1])) {
                        unorderedArrows.push(arrow);
                    }
                    else {
                        throw new Error(`Arrow ${arrow[0]} --> ${arrow[1]} invalid`)
                    }
                }
                else {
                    throw new Error('Invalid arrow')
                }
            });
        }
        if (typeof arrows === 'string') {
            
            for (const match of arrows.matchAll(/\[([^, ;]+)[ ,;]([^, ;]+)\]/g)) {
                if (vertices.match(match[1]) && vertices.match(match[2])) {
                    unorderedArrows.push([this.vertexDict[match[1]], this.vertexDict[match[2]]]);
                }
                else {
                    throw new Error(`Arrow ${match[1]} --> ${match[2]} invalid`);
                }
            }
        }

        // order vertices such that a : i -> j implies i > j
        const orderedVertices = this.orderVertices(this.arrowMatrix({v: unorderedVertices, a: unorderedArrows}));
        for (let j = 0; j < orderedVertices.length; j++) {
            this.vertices.push(j);
        }
        // order arrows prioritising target over source
        unorderedArrows.forEach(arrow => {
            const ar = [orderedVertices.indexOf(arrow[0]), orderedVertices.indexOf(arrow[1])];
            for (let j = 0; j <= this.arrows.length; j++) {
                if (j === this.arrows.length || (ar[1] < this.arrows[j][1] || (ar[1] === this.arrows[j][1] && ar[0] <= this.arrows[j][0]))) {
                    this.arrows.splice(j, 0, ar);
                    j = this.arrows.length;
                }
                console.log(this.arrows);
            }
        });

        // remember how the internally reordered vertices relate to the user supplied once
        
        for (const vertexName in this.vertexDict) {
            this.vertexDict[vertexName] = orderedVertices.indexOf(this.vertexDict[vertexName]);
            this.vertexLabels[this.vertexDict[vertexName]] = vertexName;
        }

        // label arrows for the purpose of distinguishing arrows between the same vertices

        this.arrowLabels = []
        this.arrowDict = {};
        for (let j = 0; j < this.arrows.length; j++) {
            this.arrowLabels[j] = `a${j}`;
            this.arrowDict[this.arrowLabels[j]] = this.arrows[j];
        }

        // set properties
        this.sinks = this.findSinks({v: this.vertices, a: this.arrows});
        this.sources = this.findSources({v: this.vertices, a: this.arrows});

        this.acyclic = (this.sinks.length === 0) ? false : true;
        this.cyclic = !this.acyclic;

        // order paths in lists of homogeneous generators giving precedent to vertices closer to the target
        // one could say lexicographic in the alphabeth of the vertices with their enforced order
        this.paths = [];
        this.vertices.forEach(vertex => {
            const qv = this.pathsTo({v: this.vertices, a: this.arrows, i: vertex});
            qv.forEach(lpaths => {
                const l = lpaths[0].length - 2;

                lpaths.forEach(path => {
                    if (this.paths[l]) {
                        this.paths[l].push(path);
                    }
                    else {
                        this.paths[l] = [path];
                    }
                });
            });
        });

        this.cartan = math.map(this.computeCartan(), e => math.fraction(e,1));

        const cinv = math.inv(this.cartan);
        const ct = math.map(math.transpose(this.cartan), e => math.multiply(e, math.fraction(-1,1))); 
        this.coxeter = math.multiply(ct,cinv);

        this.pathMatrix = [];

        this.vertices.forEach(v => {
            const row = [];
            this.vertices.forEach(w => {
                row.push([]);
            });
            this.pathMatrix.push(row);
        });

        this.paths.forEach(lpaths => {

            lpaths.forEach(path => {
                this.pathMatrix[path[0]][path[path.length - 1]].push(path);
            });
        });
    }

    // define methods

    // matrix m with m_{ij} = # { a : i -> j }
    arrowMatrix({v = this.vertices, a = this.arrows} = {}) {
        const m = math.zeros(v.length, v.length);

        a.forEach(arrow => {
            m.set([arrow[0],arrow[1]], m.get([arrow[0],arrow[1]]) + 1);
        });
        return m;
    }

    // order vertices {0, ..., n} based on matrix m with m_{ij} = # { a : i -> j }
    orderVertices(m) {
        const orderedVertices = [];
        const remaining = [];
        for (let i = 0; i < m.size()[0]; i++) {
            remaining.push(i);
        }
        for (let i = 0; i < m.size()[0]; i++) {
            for (let j = 0; j < remaining.length; j++) {
                let s = 0;
                remaining.forEach(k => {
                    s = s + m.get([remaining[j],k]);
                });
                if (s === 0) {
                    orderedVertices.push(remaining[j]);
                    remaining.splice(j,1);
                    j = remaining.length;
                }
            };
        }
        return orderedVertices;
    }

    // list of list [in, out] for each vertex i where [in, out] = [#{a : t(a) = i}, #{a : s(a) = i}]
    flow({v = this.vertices, a = this.arrows} = {}) {
        const degrees = [];
        v.forEach(vertex => degrees.push([0,0]));
        a.forEach(arrow => {
            degrees[arrow[0]][1]++;
            degrees[arrow[1]][0]++;
        });
        return degrees;
    }

    // list of vertices that are a source
    findSources({v = this.vertices, a = this.arrows} = {}) {
        const sources = [];
        let i = 0;
        this.flow({v: v, a: a}).forEach(degree => {
            if (degree[0] === 0) {
                sources.push(i);
            }
            i++;
        });
        return sources;
    }

    // list of vertices that are a sink
    findSinks({v = this.vertices, a = this.arrows} = {}) {
        const sinks = [];
        let i = 0;
        this.flow({v: v, a: a}).forEach(degree => {
            if (degree[1] === 0) {
                sinks.push(i);
            }
            i++;
        });
        return sinks;
    }

    // returns a tuple of vertices and arrows equal to the uinput vertices and arrows, except that
    // the vertex or vertices i are reoved along with any arrows from or to them
    removeVertices({v = this.vertices, a = this.arrows, i = null} = {}) {

        if (!i) {
            throw new Error('Vertex to remove not specified');
        }
        if (typeof i === 'number') {
            i = [i];
        }
        i.sort((a,b) => b - a);

        i.forEach(vertex => {
            if (vertex > v.length - 1) {
                throw new Error('vertex not existent, thus cannot be removed');
            }
        });

        for (let j= 0; j < a.length; ) {
            if (i.includes(a[j][0]) || i.includes(a[j][1])) {
                a.splice(j,1);
            }
            else {
                j++;
            }
        }

        i.forEach(vertex => {
            v.splice(vertex, 1);
        })

        return [v, a];
    }
    
    // list of all the paths starting at i
    pathsFrom({v = this.vertices, a = this.arrows, i = null} = {}) {

        if (i === null) {
            throw new Error('Source vertex not specified');
        }
        const p = [];

        for (let j = 0 ; j < v.length - 1 ; j++) {  // maybe 'j < v.length' to allow cyclyc paths

            const pp = [];

            if (p.length > 0) {
                p[p.length - 1].forEach(path => {
                    a.forEach(arrow => {
                        if (arrow[0] === path[path.length - 1]) {
                            pp.push([...path, arrow[1]]);
                        }
                    });
                });
                if (pp.length > 0) {
                    p.push(pp);
                }
                else {
                    j = v.length;
                }
            }
            else {
                a.forEach(arrow => {
                    if (arrow[0] === i) {
                        pp.push(arrow);
                    }
                });
                if (pp.length > 0) {
                    p.push(pp);
                }
                else {
                    j = v.length;
                }
            }
        }
        return p;
    }

    // list of all the paths ending at i
    pathsTo({v = this.vertices, a = this.arrows, i = null} = {}) {

        if (i === null) {
            throw new Error('Target vertex not specified');
        }
        const p = [];

        for (let j = 0 ; j < v.length - 1 ; j++) { // maybe 'j < v.length' to allow cyclyc paths
            const pp = [];
            
            if (p.length > 0) {
                p[p.length - 1].forEach(path => {
                    a.forEach(arrow => {
                        if (arrow[1] === path[0]) {
                            pp.push([arrow[0], ...path]);
                        }
                    });
                });
                if (pp.length > 0) {
                    p.push(pp);
                }
                else {
                    j = v.length;
                }
            }
            else {
                a.forEach(arrow => {
                    if (arrow[1] === i) {
                        pp.push(arrow);
                    }
                });
                if (pp.length > 0) {
                    p.push(pp);
                }
                else {
                    j = v.length;
                }
            }
        }
        return p;
    }

    // list of paths from i to j
    pathsFromTo({v = this.vertices, a = this.arrows, i = null, j = null} = {}) {

        if (i === null || j === null) {
            throw new Error('Source vertex not specified');
        }
        const p = [];

        const iq = this.pathsFrom({v: v, a: a, i: i});
        for (let k = 0; k < iq.length; k++) {
            const pp = iq[k];
            pp.forEach(ppp => {
                if (ppp[ppp.length - 1] === j) {
                    if(p[k]) {
                        p[k].push(ppp);
                    }
                    else {
                        p[k] = [ppp];
                    }
                }
            });
        }
        return p;
    }

    // cartan matrix
    computeCartan({v = this.vertices, a = this.arrows, p = this.paths} = {}) {
        const c = math.zeros(v.length, v.length);
        p.forEach(lpaths => {
            lpaths.forEach(path => {
                c.set([path[path.length - 1],path[0]], c.get([path[path.length - 1],path[0]]) + 1);
            });
        });
        v.forEach(vertex => {
            c.set([vertex, vertex], c.get([vertex, vertex]) + 1);
        });
        return c;
    }


    // indecomposables e_i(kQ/I) given as an array with the dimensionvecor and matrices with respect 
    // to the canonical basis obtained by ordering the paths according to their order in this.paths
    computeProjectiveIndecomposables({v = this.vertices, a = this.arrows, p = this.paths} = {}) {
        const indecomposables = [];
        v.forEach (vertex => {
            a.forEach(arrow => {
                const vkQs = this.pathsFromTo({v: v, a: a, i: vertex, j: arrow[0]});
                const vkQt = this.pathsFromTo({v: v, a: a, i: vertex, j: arrow[1]});
            });
        });
    }
}