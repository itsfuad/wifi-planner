import { calculateSignalStrength } from '../sim/physics';
import { BackhaulType } from '../model/types';
import type { FloorPlan } from '../model/types';

// A helper to calculate backhaul quality
export const calculateBackhaulRSSI = (nodeId: string, plan: FloorPlan) => {
    const node = plan.routers.find((r) => r.id === nodeId);
    if (!node || !node.meshParentId) return -120;

    const parent = plan.routers.find((r) => r.id === node.meshParentId);
    if (!parent) return -120;

    // Check for Wired Backhaul
    if (node.backhaulType === BackhaulType.Wired) {
        return -10; // "Perfect" signal for wired
    }

    // Wireless: determine frequency
    let freq = 5200; // Default 5GHz
    if (node.backhaulBand) {
        if (node.backhaulBand === 2.4) freq = 2400;
        else if (node.backhaulBand === 5) freq = 5200;
        else if (node.backhaulBand === 6) freq = 6000;
    } else {
        // Fallback to parent's band or default
        freq = parent.band === 2.4 ? 2400 : parent.band === 5 ? 5200 : 6000;
    }

    return calculateSignalStrength(
        parent.txPower,
        parent.gain,
        freq,
        { x: parent.x, y: parent.y },
        { x: node.x, y: node.y },
        plan.walls,
        plan.doors,
        plan.obstacles
    );
};

export const getSignalQualityColor = (rssi: number) => {
    if (rssi >= -60) return '#00ff00'; // Excellent
    if (rssi >= -70) return '#aaaa00'; // Good
    if (rssi >= -80) return '#ffaa00'; // Fair
    return '#ff0000'; // Poor
};
