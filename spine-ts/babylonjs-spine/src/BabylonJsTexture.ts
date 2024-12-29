import {
	Texture as SpineTexture,
	TextureFilter,
	TextureWrap,
} from "@esotericsoftware/spine-core";
import * as BABYLON from "babylonjs";

/**
 * BabylonJsTexture
 *
 * This class extends the Spine Runtime Texture to store a Babylon.js DynamicTexture.
 * It handles filtering/wrap setup for Spine textures in Babylon.js.
 */
export class BabylonJsTexture extends SpineTexture {
	/** The actual Babylon.js DynamicTexture object */
	public texture: BABYLON.DynamicTexture;

	/**
	 * @param image - HTMLImageElement or ImageBitmap
	 * @param scene - The current Babylon.js Scene
	 * @param premultipliedAlpha - PMA setting from Spine
	 */
	constructor(
		image: HTMLImageElement | ImageBitmap,
		scene: BABYLON.Scene,
	) {
		super(image);

		// Retrieve width/height from the image
		const width = (image as HTMLImageElement).width ||
			(image as ImageBitmap).width;
		const height = (image as HTMLImageElement).height ||
			(image as ImageBitmap).height;

		// Create a new DynamicTexture
		this.texture = new BABYLON.DynamicTexture(
			"spineDynamicTexture",
			{ width, height },
			scene,
			false,
		);

		// Draw the raw image onto the DynamicTexture
		const context = this.texture.getContext();
		context.clearRect(0, 0, width, height);
		context.drawImage(image as CanvasImageSource, 0, 0, width, height);
		this.texture.update(false);

		// Indicate that the texture has alpha
		this.texture.hasAlpha = true;

		// Handling premultipliedAlpha may require custom blending in Babylon.js.
		// By default, Babylon.js won't automatically handle premultiplied alpha on DynamicTextures.
		// Additional logic might be necessary, depending on your exact use case.
	}

	/**
	 * Called by Spine to set min/mag filter
	 */
	setFilters(minFilter: TextureFilter, magFilter: TextureFilter) {
		// Convert Spine filter to Babylon sampling mode
		const babylonMinFilter = BabylonJsTexture.toBabylonSamplingMode(minFilter);
		const babylonMagFilter = BabylonJsTexture.toBabylonSamplingMode(magFilter);

		// Babylon.js typically uses a single samplingMode for min/mag combined.
		if (this.texture._texture) {
			this.texture._texture.samplingMode = babylonMinFilter;
		}
	}

	/**
	 * Called by Spine to set wrap mode
	 */
	setWraps(uWrap: TextureWrap, vWrap: TextureWrap) {
		this.texture.wrapU = BabylonJsTexture.toBabylonTextureWrap(uWrap);
		this.texture.wrapV = BabylonJsTexture.toBabylonTextureWrap(vWrap);
	}

	/**
	 * Dispose GPU resources
	 */
	dispose() {
		this.texture.dispose();
	}

	/**
	 * Convert Spine's TextureFilter to Babylon's sampling mode
	 */
	static toBabylonSamplingMode(filter: TextureFilter): number {
		switch (filter) {
			case TextureFilter.Linear:
				return BABYLON.Texture.BILINEAR_SAMPLINGMODE;
			case TextureFilter.MipMap:
			case TextureFilter.MipMapLinearNearest:
			case TextureFilter.MipMapNearestLinear:
			case TextureFilter.MipMapNearestNearest:
				return BABYLON.Texture.TRILINEAR_SAMPLINGMODE;
			case TextureFilter.Nearest:
				return BABYLON.Texture.NEAREST_SAMPLINGMODE;
			default:
				throw new Error("Unknown texture filter: " + filter);
		}
	}

	/**
	 * Convert Spine's TextureWrap to Babylon's wrap mode
	 */
	static toBabylonTextureWrap(wrap: TextureWrap): number {
		switch (wrap) {
			case TextureWrap.ClampToEdge:
				return BABYLON.Texture.CLAMP_ADDRESSMODE;
			case TextureWrap.MirroredRepeat:
				return BABYLON.Texture.MIRROR_ADDRESSMODE;
			case TextureWrap.Repeat:
				return BABYLON.Texture.WRAP_ADDRESSMODE;
			default:
				throw new Error("Unknown texture wrap: " + wrap);
		}
	}
}
