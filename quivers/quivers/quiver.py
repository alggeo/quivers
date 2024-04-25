class quiver:
    def __init__(self, vertices, sources, targets):
        self.vertices = vertices
        self.sources = sources
        self.targets = targets

        self.numVertices = len(self.vertices)
        self.numArrows = len(self.sources)

        self.findSinks()
        self.findCosinks()
        self.orderVertices()

    def init_diamond_plus(self):
        self.constructArrowMatrix()
        self.cyclic = self.hasCycles()
        self.paths = self.constructPaths()
        self.constructCartan()

    def isSink(self, vertex):
        for i in self.sources:
            if i == vertex:
                return False
        return True

    def isCosink(self, vertex):
        for i in self.targets:
            if i == vertex:
                return False
        return True

    def findSinks(self):
        self.sinks = []
        for i in self.vertices:
            if self.isSink(i):
                self.sinks.append(i)

    def findCosinks(self):
        self.cosinks = []
        for i in self.vertices:
            if self.isCosink(i):
                self.cosinks.append(i)

    def removeVertices(self, vertices, removedSources = None, removedTargets = None):
        newVertices = [v for v in self.vertices if not v in vertices]
        newSources = []
        newTargets = []
        for i in range(self.numArrows):
            if ((not self.sources[i] in vertices) and (not self.targets[i] in vertices)):
                newSources.append(self.sources[i])
                newTargets.append(self.targets[i])
            else:
                if (not removedSources == None):
                    removedSources.append(self.sources[i])
                if not removedTargets == None:
                    removedTargets.append(self.targets[i])
        return quiver(newVertices, newSources, newTargets)

    def orderVertices(self):
        self.orderedVertices = self.cosinks.copy()
        if len(self.cosinks.copy()) > 0:
            selfWithoutSinks = self.removeVertices(self.cosinks)
            self.orderedVertices = self.orderedVertices + selfWithoutSinks.orderedVertices

    def constructArrowMatrix(self):
        self.arrowMatrix = matrix.zero(ZZ, self.numVertices, self.numVertices)
        for i in range(self.numArrows):
            self.arrowMatrix[self.sources[i], self.targets[i]] = self.arrowMatrix[self.sources[i], self.targets[i]] + 1

    def hasCycles(self):
        if self.numVertices == 0:
            return bool(self.numArrows)
        selfWithoutSinks = self.removeVertices(self.sinks)
        if selfWithoutSinks.numVertices == self.numVertices:
            return True
        return selfWithoutSinks.hasCycles()

    
    # from here on methods may require computation of attributes exceeding init
    
    def constructPaths(self):
        try:
            self.cyclic
        except AttributeError:
            self.cyclic = self.hasCycles()
        except:
            raise Execption("Problem determining cyclicity")

        if self.cyclic:
            return []
            
        if self.numVertices <= 1:
            return [[self.vertices]]

        removedTargets = []
        
        selfPathsWithOneFewerCosink = self.removeVertices([self.cosinks[0]], None, removedTargets).constructPaths()
        print(self.cosinks[0], selfPathsWithOneFewerCosink)
        paths = [[[self.cosinks[0]]] + [v for v in selfPathsWithOneFewerCosink[0]]]
        for i in range(len(selfPathsWithOneFewerCosink)):
            iPathsToAdd = []
            for j in selfPathsWithOneFewerCosink[i]:
                if j[0] in removedTargets:
                    iPathsToAdd.append([self.cosinks[0]] + j)
            if i < len(selfPathsWithOneFewerCosink) - 1:
                paths.append(iPathsToAdd + selfPathsWithOneFewerCosink[i + 1])
            elif len(iPathsToAdd) > 0:
                paths.append(iPathsToAdd)
        return paths

    def constructCartan(self):
        try:
            self.paths
        except AttributeError:
            self.paths = self.constructPaths()
        except:
            raise Execption("Problem constructing paths")

        self.cartan = matrix.zero(ZZ, self.numVertices, self.numVertices)

        for pathsOfLengthI in self.paths:
            for path in pathsOfLengthI:
                self.cartan[path[0], path[-1]] = self.cartan[path[0], path[-1]] + 1