import {
	BlendMode,
	Texture,
	TextureFilter,
	TextureWrap,
} from "@esotericsoftware/spine-core";
import { DynamicTexture, Scene, Texture as BabylonTexture } from "babylonjs";

export class BabylonJsTexture extends Texture {
	texture: BabylonTexture;

	constructor(image: HTMLImageElement | ImageBitmap, scene: Scene) {
		super(image);
		if (image instanceof ImageBitmap) {
			this.texture = new DynamicTexture("dynamicTexture", image, scene);
		} else {
			this.texture = new BabylonTexture(image.src, scene);
		}
	}

	setFilters(minFilter: TextureFilter, magFilter: TextureFilter) {
	}

	setWraps(uWrap: TextureWrap, vWrap: TextureWrap) {
	}

	dispose() {
		this.texture.dispose();
	}
}
