declare global {
	var require: any;
	var BABYLON: any;
}

if (typeof window !== "undefined" && window.BABYLON) {
	const prevRequire = window.require;
	(window as any).require = (x: string) => {
		if (prevRequire) return prevRequire(x);
		else if (x === "babylonjs") return window.BABYLON;
	};
}

export {};
