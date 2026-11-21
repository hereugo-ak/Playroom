# Playroom 3D product studio

A premium interactive 3D viewer for selected products. Built with Three.js inside the existing Vite app and loaded only when the 3D route is opened.

## First product

```text
Little Architect Wooden Blocks
```

Route:

```text
#/3d/little-architect-wooden-blocks
```

The product page shows a **View in 3D** button only when `has3D` is true.

## Stack

- `three`
- `OrbitControls`
- `RoundedBoxGeometry`
- `GLTFLoader` for future external GLB models
- HTML/CSS overlay for hotspots and controls

Three.js is dynamically imported from `js/product-3d-viewer.js`, so the main storefront bundle is not increased by the 3D engine.

## Files

| File | Purpose |
| --- | --- |
| `js/product-3d-viewer.js` | Three.js scene, controls, animations, hotspots, cleanup |
| `css/product-3d.css` | Premium editorial viewer shell |
| `js/data.js` | `has3D` flag and `PRODUCT_3D_CONFIG` |
| `js/app.js` | Route, PDP button, lazy mount/dispose |

## Scene design

The first product uses an art-directed procedural scene:

- rounded beechwood blocks with generated wood grain
- warm studio lighting and soft contact shadow
- close-up product mode
- child-scale reusable human figure
- stylized-realistic child hand used in the play animation
- no cartoon mascot, no neon grid, no generic model-viewer iframe

The human figure/hand rig is reusable. Future products can use the same rig with different product scenes.

## Modes

| Mode | Behaviour |
| --- | --- |
| Product | Orbit, zoom, hotspots, auto-rotate |
| In play | Reusable child hand animates the product through a short play sequence |
| Scale | Realistic-proportioned child figure appears beside the product |

Controls:

- drag to orbit
- scroll / pinch to zoom
- auto-rotate toggle
- reset view
- hotspot focus

## Adding another product

1. Add a config entry to `PRODUCT_3D_CONFIG` in `js/data.js`.
2. Set `has3D: true` on that product.
3. If using a GLB, set:

```js
modelType: 'glb'
modelUrl: 'assets/3d/your-model.glb'
```

If `modelUrl` is present, the viewer loads the GLB. If loading fails, it falls back to the procedural scene.

## Performance

- lazy-loaded Three.js chunk
- capped device pixel ratio
- resize observer
- render loop stops on route change
- WebGL failure falls back to the product poster
- reduced-motion CSS support

## Testing checklist

1. PDP shows **View in 3D** only on the selected product.
2. 3D route opens with poster/loading state.
3. Drag and zoom work on desktop and touch.
4. Hotspots show and focus correctly.
5. Product / In play / Scale modes switch cleanly.
6. Reset and auto-rotate work.
7. Navigating away disposes the renderer.
8. WebGL fallback shows the poster.
9. Mobile layout keeps the canvas and controls readable.
10. No major bundle regression on non-3D routes.
