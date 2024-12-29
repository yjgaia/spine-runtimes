import { AssetManagerBase } from "@esotericsoftware/spine-core";
import { Scene } from "babylonjs";
import { BabylonJsTexture } from "./BabylonJsTexture.js";

export class AssetManager extends AssetManagerBase {
	constructor(
		scene: Scene,
		pathPrefix: string = "",
	) {
		super(
			(image: HTMLImageElement | ImageBitmap) => {
				return new BabylonJsTexture(image, scene);
			},
			pathPrefix,
		);
	}
}
