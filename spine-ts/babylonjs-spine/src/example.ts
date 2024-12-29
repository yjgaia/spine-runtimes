import {
  ArcRotateCamera,
  Camera,
  Engine,
  HemisphericLight,
  Scene,
  Vector3,
} from "babylonjs";
import { AssetManager } from "./AssetManager.js";
import { SkeletonMesh } from "./SkeletonMesh.js";
import {
  AtlasAttachmentLoader,
  SkeletonJson,
} from "@esotericsoftware/spine-core";

let engine: Engine, scene: Scene, camera: Camera;
let assetManager: AssetManager;
let skeletonMesh: SkeletonMesh;

// Paths to your Spine files (adjust these for your own folder/filenames)
let baseUrl = "assets/";
let skeletonFile = "raptor-pro.json";
let atlasFile = "raptor.atlas";
let animation = "walk"; // The name of the animation to play

/**
 * Initializes Babylon engine and scene.
 */
function init() {
  // Get canvas
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

  // Create engine
  engine = new Engine(canvas, true);

  // Create a scene
  scene = new Scene(engine);

  // Set up a camera (ArcRotateCamera for easy orbiting, similar to OrbitControls in Three.js)
  camera = new ArcRotateCamera(
    "camera",
    Math.PI / 2, // alpha
    Math.PI / 4, // beta
    500, // radius
    new Vector3(0, 0, 0),
    scene,
  );
  camera.attachControl(canvas, true);

  // Create a basic light
  new HemisphericLight(
    "light",
    new Vector3(0, 1, 0),
    scene,
  );

  // Create an asset manager for Spine
  assetManager = new AssetManager(scene, baseUrl);

  // Queue loads for skeleton JSON and its atlas
  assetManager.loadText(skeletonFile);
  assetManager.loadTextureAtlas(atlasFile);

  // Once the assets are queued, start the render loop
  engine.runRenderLoop(() => {
    if (assetManager.isLoadingComplete() && !skeletonMesh) {
      // Load skeleton once everything is ready
      loadSkeleton();
    }
    if (skeletonMesh) {
      // Calculate delta time for spine animation
      const deltaTime = engine.getDeltaTime() / 1000;
      skeletonMesh.update(deltaTime);
    }
    scene.render();
  });

  // Handle window resize
  window.addEventListener("resize", () => {
    engine.resize();
  });
}

/**
 * Called when the AssetManager has finished loading all required assets.
 * Creates the Spine SkeletonMesh and adds it to the scene.
 */
function loadSkeleton() {
  // Retrieve text data for .json
  const jsonData = assetManager.require(skeletonFile);

  // Retrieve the atlas (which also has the .png loaded)
  const atlas = assetManager.require(atlasFile);

  // Create the AtlasAttachmentLoader from your atlas
  const atlasLoader = new AtlasAttachmentLoader(atlas);

  // Create a SkeletonJson parser
  const skeletonJson = new SkeletonJson(atlasLoader);
  skeletonJson.scale = 0.4; // scale your model if needed

  // Parse skeleton data
  const skeletonData = skeletonJson.readSkeletonData(jsonData);

  // Create the SkeletonMesh
  skeletonMesh = new SkeletonMesh("skeletonData", scene, { skeletonData });

  // Set an animation
  skeletonMesh.animationState.setAnimation(0, animation, true);

  // Adjust skeletonMesh position or rotation if you like
  // skeletonMesh.position.y = -100;

  // Add skeletonMesh's root node to the Babylon scene
  // (Since SkeletonMesh extends TransformNode, we can just add it to the scene)
  skeletonMesh.setParent(scene.rootNodes[0]);
}

// Start everything
//init();
