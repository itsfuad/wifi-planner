# Wi-Fi Planner

A web application for designing a home floor plan and simulating Wi-Fi coverage.

## Features

- **Floor Plan Editor**: Draw walls, place doors, and add furniture/obstacles.
- **Router Placement**: Place Wi-Fi routers (Access Points) and configure their properties (Tx Power, Band, Gain).
- **Coverage Simulation**: Simulate Wi-Fi signal propagation using a path loss model (FSPL) and material attenuation.
- **Heatmap Visualization**: Visualize signal strength (RSSI) overlay on the floor plan.
- **Persistence**: Save/Load plans locally or Export/Import via JSON.

## Getting Started

1.  **Install Dependencies**:

    ```bash
    npm install
    ```

2.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` in your browser.

## Usage Guide

### Drawing the Floor Plan

1.  Use the **Wall Tool** to draw walls. Drag from the start point to the end point; connected endpoints snap to the grid.
2.  Use the **Door Tool** to place doors on existing walls. Hover over a wall and click.
3.  Use the **Obstacle Tool** to add furniture or other obstacles. Drag to create a rectangle.
4.  Use the **Select Tool** to select objects. You can move obstacles/routers, delete selected items (Delete/Backspace key), and edit properties in the right panel.

### Simulation

1.  Place one or more **Routers** using the Router Tool.
2.  Select a router to configure its SSID, Transmit Power, Band (2.4/5/6 GHz), and Antenna Gain.
3.  Click **Analyze** in the top bar, or enable **Live analysis** in the workspace inspector.
4.  A heatmap will appear showing the signal strength. Hover over the map to see specific RSSI values.

### Model Assumptions

- **FSPL**: Free Space Path Loss model based on distance and frequency.
- **Indoor path loss**: A frequency-dependent log-distance exponent is applied for 2.4, 5, and 6 GHz bands.
- **Attenuation**:
  - Drywall: 3 dB
  - Brick: 8 dB
  - Concrete: 12 dB
  - Glass: 2 dB
  - Wood Door: 2 dB
  - Metal Door: 10 dB
- **Obstacles**: Attenuation is applied if the signal path intersects the obstacle.
- **Mesh usability**: Radio coverage is reported separately from usable coverage. Mesh satellites without a valid or sufficiently strong uplink are flagged and excluded from usable-link estimates. Wireless backhaul capacity is reduced for forwarding airtime and shared across sibling satellites; multi-hop paths use the tightest upstream capacity.

## Tech Stack

- React + TypeScript
- Vite
- Konva / React-Konva (Canvas rendering)
- Web Worker (for off-thread simulation)

## Known Limitations

- Simulation assumes 2D plane (height is not fully modeled, though obstacles have "height" property in data, it is not currently used in the simplified 2D ray casting).
- The model is an approximation for planning; diffraction, reflection, channel contention, and client antenna behavior are not modeled.
- Touch layouts support two-finger canvas panning, but device-specific gesture behavior should still be validated on iOS Safari and Android Chrome.

## Example JSON Plan

You can use the following JSON structure to import a plan:

```json
{
  "id": "e1",
  "width": 1000,
  "height": 800,
  "walls": [
    {
      "id": "w1",
      "p1": { "x": 100, "y": 100 },
      "p2": { "x": 600, "y": 100 },
      "thickness": 15,
      "material": "brick"
    },
    {
      "id": "w2",
      "p1": { "x": 600, "y": 100 },
      "p2": { "x": 600, "y": 500 },
      "thickness": 15,
      "material": "brick"
    },
    {
      "id": "w3",
      "p1": { "x": 600, "y": 500 },
      "p2": { "x": 100, "y": 500 },
      "thickness": 15,
      "material": "brick"
    },
    {
      "id": "w4",
      "p1": { "x": 100, "y": 500 },
      "p2": { "x": 100, "y": 100 },
      "thickness": 15,
      "material": "brick"
    }
  ],
  "doors": [
    {
      "id": "d1",
      "wallId": "w1",
      "distance": 250,
      "width": 90,
      "type": "wood"
    }
  ],
  "obstacles": [
    {
      "id": "o1",
      "x": 200,
      "y": 200,
      "width": 100,
      "height": 200,
      "rotation": 0,
      "type": "bed",
      "label": "Master Bed"
    }
  ],
  "routers": [
    {
      "id": "r1",
      "x": 350,
      "y": 300,
      "txPower": 20,
      "band": 5,
      "gain": 2,
      "ssid": "Home-WiFi",
      "mode": "solo",
      "meshParentId": null,
      "backhaulType": "wireless",
      "backhaulBand": 5
    }
  ]
}
```
