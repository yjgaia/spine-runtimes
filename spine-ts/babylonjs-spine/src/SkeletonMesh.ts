import {
	AnimationState,
	AnimationStateData,
	ClippingAttachment,
	Color,
	MeshAttachment,
	Physics,
	RegionAttachment,
	Skeleton,
	SkeletonClipping,
	SkeletonData,
} from "@esotericsoftware/spine-core";
import * as BABYLON from "babylonjs";
import { BabylonJsTexture } from "./BabylonJsTexture.js";
import { MeshBatcher } from "./MeshBatcher.js";

/**
 * Configuration interface for creating a SkeletonMesh.
 */
export interface SkeletonMeshConfiguration {
	/** The SkeletonData loaded from SkeletonJson or SkeletonBinary */
	skeletonData: SkeletonData;
	/** Whether to enable two-color tint (Tint black) */
	twoColorTint?: boolean;
}

/**
 * SkeletonMesh
 *
 * This class manages a Spine Skeleton, its AnimationState, and a set of MeshBatchers in Babylon.js.
 * It extends TransformNode so that all MeshBatcher meshes can be parented here.
 */
export class SkeletonMesh extends BABYLON.TransformNode {
	public skeleton: Skeleton;
	public animationState: AnimationState;

	private _batcherArray: MeshBatcher[] = [];
	private _nextBatchIndex = 0;

	private _clipper = new SkeletonClipping();
	private _vertexSize = 9; // Default: x, y, z, r, g, b, a, u, v
	private _tempColor = new Color();
	private _tempDarkColor = new Color();

	/** z-offset between slots (for layering) */
	public zOffset: number = 0.1;

	/**
	 * @param name - TransformNode name
	 * @param scene - Babylon.js Scene
	 * @param config - SkeletonMeshConfiguration
	 */
	constructor(
		name: string,
		scene: BABYLON.Scene,
		config: SkeletonMeshConfiguration,
	) {
		super(name, scene);
		this._scene = scene;

		// Create the Spine Skeleton
		this.skeleton = new Skeleton(config.skeletonData);
		const animData = new AnimationStateData(config.skeletonData);
		this.animationState = new AnimationState(animData);

		// If twoColorTint is needed, increase vertex size accordingly
		if (config.twoColorTint) {
			this._vertexSize = 9 + 4; // hypothetical extra space for dark color
		}
	}

	/**
	 * Update the Spine skeleton and animation state.
	 * @param deltaTime - Time in seconds since last update
	 */
	public update(deltaTime: number) {
		// Update animation state
		this.animationState.update(deltaTime);
		this.animationState.apply(this.skeleton);

		// Update skeleton with physics (Spine 4.1+)
		this.skeleton.update(deltaTime);
		this.skeleton.updateWorldTransform(Physics.update);

		// Rebatch the geometry
		this.updateGeometry();
	}

	/**
	 * Dispose all batchers and this transform node.
	 */
	public dispose() {
		super.dispose();
		for (const b of this._batcherArray) {
			b.dispose();
		}
	}

	/**
	 * Clear all existing batchers.
	 */
	private _clearBatches() {
		for (let i = 0; i < this._batcherArray.length; i++) {
			const batcher = this._batcherArray[i];
			batcher.clear();
			batcher.mesh.setEnabled(false);
		}
		this._nextBatchIndex = 0;
	}

	/**
	 * Get the next available batcher or create a new one.
	 */
	private _nextBatcher(): MeshBatcher {
		if (this._batcherArray.length <= this._nextBatchIndex) {
			const newBatch = new MeshBatcher(this._scene);
			newBatch.mesh.parent = this;
			this._batcherArray.push(newBatch);
		}
		const batch = this._batcherArray[this._nextBatchIndex++];
		batch.mesh.setEnabled(true);
		return batch;
	}

	/**
	 * Loop through the skeleton's draw order and feed vertex/index data into a MeshBatcher.
	 */
	private updateGeometry() {
		this._clearBatches();

		const drawOrder = this.skeleton.drawOrder;
		const clipper = this._clipper;

		let batch = this._nextBatcher();
		batch.begin();

		let z = 0;
		const zOffset = this.zOffset;

		for (let i = 0, n = drawOrder.length; i < n; i++) {
			const slot = drawOrder[i];
			if (!slot.bone.active) {
				clipper.clipEndWithSlot(slot);
				continue;
			}

			const attachment = slot.getAttachment();
			if (attachment instanceof ClippingAttachment) {
				clipper.clipStart(slot, attachment);
				continue;
			}

			let texture: BabylonJsTexture | null = null;
			let regionTriangles: number[] | null = null;
			let finalVertices: Float32Array | null = null;
			let finalVerticesLength = 0;
			let finalIndices: number[] = [];
			let finalIndicesLength = 0;

			// Handle RegionAttachment
			if (attachment instanceof RegionAttachment) {
				texture = attachment.region?.texture as BabylonJsTexture;
				const vertexCount = 4;
				finalVerticesLength = vertexCount * this._vertexSize;
				const verts = new Float32Array(finalVerticesLength);
				attachment.computeWorldVertices(slot, verts, 0, this._vertexSize);

				regionTriangles = [0, 1, 2, 2, 3, 0];
				finalIndices = regionTriangles;
				finalIndicesLength = regionTriangles.length;
				finalVertices = verts;

				// Handle MeshAttachment
			} else if (attachment instanceof MeshAttachment) {
				texture = attachment.region?.texture as BabylonJsTexture;
				const mesh = attachment;
				const vertexCount = mesh.worldVerticesLength >> 1;
				finalVerticesLength = vertexCount * this._vertexSize;
				const verts = new Float32Array(finalVerticesLength);
				mesh.computeWorldVertices(
					slot,
					0,
					mesh.worldVerticesLength,
					verts,
					0,
					this._vertexSize,
				);

				regionTriangles = mesh.triangles;
				finalIndices = regionTriangles;
				finalIndicesLength = regionTriangles.length;
				finalVertices = verts;
			} else {
				clipper.clipEndWithSlot(slot);
				continue;
			}

			// If there's no valid texture, skip
			if (!texture || !finalVertices) {
				clipper.clipEndWithSlot(slot);
				continue;
			}

			// Calculate final color
			const skeletonColor = this.skeleton.color;
			const slotColor = slot.color;
			const attachmentColor = (attachment as any).color || Color.WHITE;
			const alpha = skeletonColor.a * slotColor.a * attachmentColor.a;
			this._tempColor.set(
				skeletonColor.r * slotColor.r * attachmentColor.r,
				skeletonColor.g * slotColor.g * attachmentColor.g,
				skeletonColor.b * slotColor.b * attachmentColor.b,
				alpha,
			);

			if (!slot.darkColor) {
				this._tempDarkColor.set(0, 0, 0, 0);
			} else {
				this._tempDarkColor.set(
					slot.darkColor.r,
					slot.darkColor.g,
					slot.darkColor.b,
					slot.darkColor.a,
				);
			}

			// Clipping logic (if clipper is active) can be applied here.
			// This sample omits clipper details.

			// Apply color/uv to finalVertices if needed
			// For demonstration, assume the vertex layout is (x, y, z, r, g, b, a, u, v)
			// Two-color extension would require storing dark color as well.
			for (let v = 2; v < finalVerticesLength; v += this._vertexSize) {
				finalVertices[v + 0] = this._tempColor.r; // r
				finalVertices[v + 1] = this._tempColor.g; // g
				finalVertices[v + 2] = this._tempColor.b; // b
				finalVertices[v + 3] = this._tempColor.a; // a
				// Then u, v, etc.
				// If twoColorTint is enabled, you would insert dark color in the extra fields.
			}

			// Check if we can batch
			if (
				!batch.canBatch(
					finalVerticesLength / this._vertexSize,
					finalIndicesLength,
				)
			) {
				batch.end();
				batch = this._nextBatcher();
				batch.begin();
			}

			// Find or create material
			const matIndex = batch.findMaterialIndex(
				texture.texture,
				slot.data.blendMode,
			);
			batch.addMaterialGroup(finalIndicesLength, matIndex);
			batch.batch(
				finalVertices,
				finalVerticesLength,
				finalIndices,
				finalIndicesLength,
				z,
			);

			z += zOffset;
			clipper.clipEndWithSlot(slot);
		}

		clipper.clipEnd();
		batch.end();
	}
}
