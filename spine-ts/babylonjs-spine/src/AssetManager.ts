import { AssetManagerBase, Downloader } from "@esotericsoftware/spine-core";
import * as BABYLON from "babylonjs";
import { BabylonJsTexture } from "./BabylonJsTexture.js";

/**
 * A custom asset manager for loading images and creating BabylonJsTexture for Spine.
 */
export class AssetManager extends AssetManagerBase {
	constructor(
		scene: BABYLON.Scene,
		pathPrefix: string = "",
		downloader: Downloader = new Downloader(),
	) {
		super(
			(image: HTMLImageElement | ImageBitmap) => {
				return new BabylonJsTexture(image, scene);
			},
			pathPrefix,
			downloader,
		);
	}
}
