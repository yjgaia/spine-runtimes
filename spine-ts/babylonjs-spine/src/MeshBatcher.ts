import * as BABYLON from "babylonjs";
import { BlendMode } from "@esotericsoftware/spine-core";

/**
 * MaterialWithTexture
 *
 * A material interface with an optional spineTexture to store the actual Babylon Texture used by Spine.
 */
export interface MaterialWithTexture extends BABYLON.Material {
	spineTexture?: BABYLON.Texture;
}

/**
 * MeshBatcher
 *
 * This class handles batching of vertices and indices from multiple Spine slot attachments
 * into a single Babylon Mesh for efficiency. It uses SubMesh to separate different materials
 * (textures, blend modes).
 */
export class MeshBatcher {
	public static MAX_VERTICES = 10920; // Arbitrary example limit

	private _scene: BABYLON.Scene;
	public mesh: BABYLON.Mesh;

	// CPU-side buffers
	private vertices: Float32Array;
	private colors: Float32Array;
	private uv: Float32Array;
	private indices: Uint16Array;

	private vertexCount = 0;
	private indexCount = 0;

	// SubMesh grouping
	private materialGroups: Array<{
		indexStart: number;
		indexCount: number;
		materialIndex: number;
	}> = [];

	// Material list
	public materials: MaterialWithTexture[] = [];

	// Kinds for vertex data
	private positionsKind = BABYLON.VertexBuffer.PositionKind;
	private colorKind = BABYLON.VertexBuffer.ColorKind;
	private uvKind = BABYLON.VertexBuffer.UVKind;

	/**
	 * @param scene - The current Babylon.js Scene
	 * @param maxVertices - Maximum vertices in the batch
	 */
	constructor(
		scene: BABYLON.Scene,
		maxVertices: number = MeshBatcher.MAX_VERTICES,
	) {
		this._scene = scene;

		// Allocate buffers
		this.vertices = new Float32Array(maxVertices * 3); // x, y, z
		this.colors = new Float32Array(maxVertices * 4); // r, g, b, a
		this.uv = new Float32Array(maxVertices * 2); // u, v
		this.indices = new Uint16Array(maxVertices * 3);

		// Create Babylon Mesh
		this.mesh = new BABYLON.Mesh("SpineBatchMesh", this._scene);
		this.mesh.setVerticesData(this.positionsKind, this.vertices, true);
		this.mesh.setVerticesData(this.colorKind, this.colors, true, 4);
		this.mesh.setVerticesData(this.uvKind, this.uv, true, 2);
		this.mesh.setIndices(this.indices, null, true);
	}

	/**
	 * Clear the batch data.
	 */
	public clear() {
		this.vertexCount = 0;
		this.indexCount = 0;
		this.materialGroups = [];
		this.mesh.subMeshes = [];
	}

	/**
	 * Call before batching any slot data.
	 */
	public begin() {
		this.clear();
	}

	/**
	 * Check if there's enough space to batch incoming data.
	 */
	public canBatch(numVertices: number, numIndices: number) {
		if (this.vertexCount + numVertices >= this.vertices.length / 3) {
			return false;
		}
		if (this.indexCount + numIndices >= this.indices.length) return false;
		return true;
	}

	/**
	 * Append vertices & indices from Spine attachments into the batch.
	 *
	 * @param vertices - Vertex data in a specific layout
	 * @param verticesLength - Number of floats in vertices
	 * @param indices - Triangle indices
	 * @param indicesLength - Number of indices
	 * @param z - z offset
	 */
	public batch(
		vertices: ArrayLike<number>,
		verticesLength: number,
		indices: ArrayLike<number>,
		indicesLength: number,
		z: number = 0,
	) {
		const baseVertex = this.vertexCount;
		let vpos = this.vertexCount * 3;
		let cpos = this.vertexCount * 4;
		let uvpos = this.vertexCount * 2;

		// Example stride of 9: x, y, z, r, g, b, a, u, v
		const stride = 9;

		// Copy vertex data to the local buffers
		for (let i = 0; i < verticesLength; i += stride) {
			// position
			this.vertices[vpos++] = vertices[i + 0]; // x
			this.vertices[vpos++] = vertices[i + 1]; // y
			this.vertices[vpos++] = vertices[i + 2]; // z

			// color
			this.colors[cpos++] = vertices[i + 3]; // r
			this.colors[cpos++] = vertices[i + 4]; // g
			this.colors[cpos++] = vertices[i + 5]; // b
			this.colors[cpos++] = vertices[i + 6]; // a

			// uv
			this.uv[uvpos++] = vertices[i + 7]; // u
			this.uv[uvpos++] = vertices[i + 8]; // v
		}

		// Copy indices
		for (let i = 0; i < indicesLength; i++) {
			this.indices[this.indexCount + i] = indices[i] + baseVertex;
		}

		this.vertexCount += verticesLength / stride;
		this.indexCount += indicesLength;
	}

	/**
	 * Create a subMesh for the latest added triangles with a specified material index.
	 */
	public addMaterialGroup(indicesLength: number, materialIndex: number) {
		const currentIndexStart = this.indexCount;
		this.materialGroups.push({
			indexStart: currentIndexStart,
			indexCount: indicesLength,
			materialIndex,
		});
	}

	/**
	 * Upload updated buffers to GPU and create subMeshes.
	 */
	public end() {
		this.mesh.updateVerticesData(this.positionsKind, this.vertices, false);
		this.mesh.updateVerticesData(this.colorKind, this.colors, false);
		this.mesh.updateVerticesData(this.uvKind, this.uv, false);
		this.mesh.updateIndices(this.indices);

		this.mesh.subMeshes = [];
		for (const group of this.materialGroups) {
			const subMesh = new BABYLON.SubMesh(
				group.materialIndex,
				0,
				this.vertexCount,
				group.indexStart,
				group.indexCount,
				this.mesh,
			);
			this.mesh.subMeshes.push(subMesh);
		}
	}

	/**
	 * Dispose mesh and free resources.
	 */
	public dispose() {
		this.mesh.dispose();
	}

	/**
	 * Find or create a material index matching the specified texture and blend mode.
	 * @param slotTexture - The Babylon texture from the Spine slot
	 * @param slotBlendMode - The Spine blend mode
	 */
	public findMaterialIndex(
		slotTexture: BABYLON.Texture,
		slotBlendMode: BlendMode,
	): number {
		for (let i = 0; i < this.materials.length; i++) {
			if (
				this.materials[i].spineTexture === slotTexture &&
				this._isSameBlendMode(this.materials[i], slotBlendMode)
			) {
				return i;
			}
		}

		// Create new material
		const newMaterial = this._createSpineMaterial(slotTexture, slotBlendMode);
		const newIndex = this.materials.length;
		this.materials.push(newMaterial);

		// Reassign multiMaterial
		this.mesh.material = null;
		const multiMat = new BABYLON.MultiMaterial("SpineMultiMat", this._scene);
		multiMat.subMaterials = this.materials;
		this.mesh.material = multiMat;

		return newIndex;
	}

	/**
	 * Compare blend mode on an existing material.
	 */
	private _isSameBlendMode(mat: MaterialWithTexture, blendMode: BlendMode) {
		// Checking alphaMode for approximate match.
		// More advanced logic might be needed for Screen or Multiply in custom shaders.
		if (
			blendMode === BlendMode.Normal &&
			mat.alphaMode === BABYLON.Engine.ALPHA_COMBINE
		) return true;
		if (
			blendMode === BlendMode.Additive &&
			mat.alphaMode === BABYLON.Engine.ALPHA_ADD
		) return true;
		if (
			blendMode === BlendMode.Multiply &&
			mat.alphaMode === BABYLON.Engine.ALPHA_MULTIPLY
		) return true;
		if (
			blendMode === BlendMode.Screen &&
			mat.alphaMode === BABYLON.Engine.ALPHA_COMBINE
		) return true;
		return false;
	}

	/**
	 * Create a basic Babylon StandardMaterial with the texture and approximate blend mode.
	 */
	private _createSpineMaterial(
		texture: BABYLON.Texture,
		blendMode: BlendMode,
	): MaterialWithTexture {
		const mat = new BABYLON.StandardMaterial(
			"SpineMaterial",
			this._scene,
		) as MaterialWithTexture;
		mat.spineTexture = texture;
		//mat.diffuseTexture = texture;
		//mat.emissiveTexture = texture; // sometimes used to avoid lighting in basic usage
		//mat.disableLighting = true;
		mat.backFaceCulling = false;
		//mat.useAlphaFromDiffuseTexture = true;

		switch (blendMode) {
			case BlendMode.Normal:
				mat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
				break;
			case BlendMode.Additive:
				mat.alphaMode = BABYLON.Engine.ALPHA_ADD;
				break;
			case BlendMode.Multiply:
				mat.alphaMode = BABYLON.Engine.ALPHA_MULTIPLY;
				break;
			case BlendMode.Screen:
			default:
				// Babylon does not have a built-in screen blend mode, so a custom shader could be used
				mat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
				break;
		}

		return mat;
	}
}
