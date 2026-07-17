/**
 * Simple HNSW (Hierarchical Navigable Small World) index implementation
 * Optimized for small datasets (~10K items) in a Durable Object context
 */

export interface HNSWNode {
	id: string
	vector: number[]
	neighbors: Map<number, Set<string>> // level -> neighbor ids
}

export interface SearchResult {
	id: string
	score: number
}

export class HNSWIndex {
	private nodes: Map<string, HNSWNode> = new Map()
	private dimensions: number
	private maxLevel = 0
	private entryPoint: string | null = null

	// HNSW parameters
	private readonly M: number = 16 // Max connections per layer
	private readonly efConstruction: number = 200 // Construction search depth
	private readonly mL: number = 1 / Math.log(this.M) // Level multiplier

	constructor(dimensions: number) {
		this.dimensions = dimensions
	}

	/**
	 * Insert a vector into the index
	 */
	insert(id: string, vector: number[]): void {
		if (vector.length !== this.dimensions) {
			throw new Error(
				`Vector dimension mismatch: expected ${this.dimensions}, got ${vector.length}`
			)
		}

		// Determine level for this node
		const level = this.randomLevel()

		const node: HNSWNode = {
			id,
			vector,
			neighbors: new Map(),
		}

		// Initialize neighbor sets for each level
		for (let l = 0; l <= level; l++) {
			node.neighbors.set(l, new Set())
		}

		this.nodes.set(id, node)

		// If first node, set as entry point
		if (this.entryPoint === null) {
			this.entryPoint = id
			this.maxLevel = level
			return
		}

		// Find entry point at highest level
		let currNode = this.entryPoint
		let currDist = this.distance(vector, this.nodes.get(currNode)!.vector)

		// Traverse from top to level+1
		for (let l = this.maxLevel; l > level; l--) {
			const changed = this.greedySearch(vector, currNode, l)
			if (changed.dist < currDist) {
				currNode = changed.id
				currDist = changed.dist
			}
		}

		// Insert at levels [level, 0]
		for (let l = Math.min(level, this.maxLevel); l >= 0; l--) {
			const neighbors = this.searchLayer(vector, currNode, this.efConstruction, l)

			// Select M best neighbors
			const selected = neighbors.slice(0, this.M)

			for (const neighbor of selected) {
				// Add bidirectional connections
				node.neighbors.get(l)!.add(neighbor.id)

				const neighborNode = this.nodes.get(neighbor.id)!
				if (!neighborNode.neighbors.has(l)) {
					neighborNode.neighbors.set(l, new Set())
				}
				neighborNode.neighbors.get(l)!.add(id)

				// Prune if over capacity
				if (neighborNode.neighbors.get(l)!.size > this.M) {
					this.pruneConnections(neighborNode, l)
				}
			}

			if (neighbors.length > 0) {
				currNode = neighbors[0].id
			}
		}

		// Update entry point if new level is higher
		if (level > this.maxLevel) {
			this.maxLevel = level
			this.entryPoint = id
		}
	}

	/**
	 * Search for k nearest neighbors
	 */
	search(query: number[], k: number, ef?: number): SearchResult[] {
		if (this.entryPoint === null) {
			return []
		}

		const searchEf = ef ?? Math.max(k, 10)

		// Find entry point
		let currNode = this.entryPoint

		// Traverse from top level to level 1
		for (let l = this.maxLevel; l >= 1; l--) {
			const changed = this.greedySearch(query, currNode, l)
			currNode = changed.id
		}

		// Search at level 0
		const candidates = this.searchLayer(query, currNode, searchEf, 0)

		return candidates.slice(0, k).map((c) => ({
			id: c.id,
			score: 1 - c.dist, // Convert distance to similarity score
		}))
	}

	/**
	 * Remove a node from the index
	 */
	delete(id: string): boolean {
		const node = this.nodes.get(id)
		if (!node) {
			return false
		}

		// Remove from all neighbors' lists
		for (const [level, neighbors] of node.neighbors) {
			for (const neighborId of neighbors) {
				const neighbor = this.nodes.get(neighborId)
				if (neighbor?.neighbors.has(level)) {
					neighbor.neighbors.get(level)!.delete(id)
				}
			}
		}

		this.nodes.delete(id)

		// Update entry point if needed
		if (this.entryPoint === id) {
			if (this.nodes.size === 0) {
				this.entryPoint = null
				this.maxLevel = 0
			} else {
				// Pick a random node as new entry point
				const nextId = this.nodes.keys().next().value!
				this.entryPoint = nextId
				const newEntry = this.nodes.get(nextId)!
				this.maxLevel = Math.max(...Array.from(newEntry.neighbors.keys()))
			}
		}

		return true
	}

	/**
	 * Get current index size
	 */
	size(): number {
		return this.nodes.size
	}

	/**
	 * Serialize index to JSON for persistence
	 */
	serialize(): string {
		const data = {
			dimensions: this.dimensions,
			maxLevel: this.maxLevel,
			entryPoint: this.entryPoint,
			nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
				id,
				vector: node.vector,
				neighbors: Array.from(node.neighbors.entries()).map(([level, neighbors]) => [
					level,
					Array.from(neighbors),
				]),
			})),
		}
		return JSON.stringify(data)
	}

	/**
	 * Deserialize index from JSON
	 */
	static deserialize(json: string): HNSWIndex {
		const data = JSON.parse(json)
		const index = new HNSWIndex(data.dimensions)
		index.maxLevel = data.maxLevel
		index.entryPoint = data.entryPoint

		for (const nodeData of data.nodes) {
			const node: HNSWNode = {
				id: nodeData.id,
				vector: nodeData.vector,
				neighbors: new Map(nodeData.neighbors.map(([l, n]: [number, string[]]) => [l, new Set(n)])),
			}
			index.nodes.set(nodeData.id, node)
		}

		return index
	}

	// Private methods

	private randomLevel(): number {
		let level = 0
		while (Math.random() < Math.exp(-level * this.mL) && level < 16) {
			level++
		}
		return level
	}

	private distance(a: number[], b: number[]): number {
		// Cosine distance (1 - cosine similarity)
		let dot = 0
		let normA = 0
		let normB = 0

		for (let i = 0; i < a.length; i++) {
			dot += a[i] * b[i]
			normA += a[i] * a[i]
			normB += b[i] * b[i]
		}

		const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB))
		return 1 - similarity
	}

	private greedySearch(
		query: number[],
		start: string,
		level: number
	): { id: string; dist: number } {
		let currNode = start
		let currDist = this.distance(query, this.nodes.get(currNode)!.vector)

		let changed = true
		while (changed) {
			changed = false
			const neighbors = this.nodes.get(currNode)?.neighbors.get(level)

			if (neighbors) {
				for (const neighborId of neighbors) {
					const neighbor = this.nodes.get(neighborId)
					if (neighbor) {
						const dist = this.distance(query, neighbor.vector)
						if (dist < currDist) {
							currNode = neighborId
							currDist = dist
							changed = true
						}
					}
				}
			}
		}

		return { id: currNode, dist: currDist }
	}

	private searchLayer(
		query: number[],
		entryPoint: string,
		ef: number,
		level: number
	): Array<{ id: string; dist: number }> {
		const visited = new Set<string>([entryPoint])
		const candidates: Array<{ id: string; dist: number }> = []
		const results: Array<{ id: string; dist: number }> = []

		const entryDist = this.distance(query, this.nodes.get(entryPoint)!.vector)
		candidates.push({ id: entryPoint, dist: entryDist })
		results.push({ id: entryPoint, dist: entryDist })

		while (candidates.length > 0) {
			// Get closest candidate
			candidates.sort((a, b) => a.dist - b.dist)
			const curr = candidates.shift()!

			// Get furthest result
			results.sort((a, b) => a.dist - b.dist)
			const furthest = results[results.length - 1]

			if (curr.dist > furthest.dist) {
				break
			}

			// Explore neighbors
			const neighbors = this.nodes.get(curr.id)?.neighbors.get(level)
			if (neighbors) {
				for (const neighborId of neighbors) {
					if (!visited.has(neighborId)) {
						visited.add(neighborId)
						const neighbor = this.nodes.get(neighborId)
						if (neighbor) {
							const dist = this.distance(query, neighbor.vector)
							if (results.length < ef || dist < furthest.dist) {
								candidates.push({ id: neighborId, dist })
								results.push({ id: neighborId, dist })
								if (results.length > ef) {
									results.sort((a, b) => a.dist - b.dist)
									results.pop()
								}
							}
						}
					}
				}
			}
		}

		results.sort((a, b) => a.dist - b.dist)
		return results
	}

	private pruneConnections(node: HNSWNode, level: number): void {
		const neighbors = node.neighbors.get(level)!
		if (neighbors.size <= this.M) return

		// Calculate distances and keep closest M
		const scored = Array.from(neighbors).map((id) => ({
			id,
			dist: this.distance(node.vector, this.nodes.get(id)!.vector),
		}))

		scored.sort((a, b) => a.dist - b.dist)
		const toKeep = new Set(scored.slice(0, this.M).map((s) => s.id))

		// Remove connections that didn't make the cut
		for (const id of neighbors) {
			if (!toKeep.has(id)) {
				neighbors.delete(id)
				// Also remove reverse connection
				const other = this.nodes.get(id)
				if (other?.neighbors.has(level)) {
					other.neighbors.get(level)!.delete(node.id)
				}
			}
		}
	}
}
