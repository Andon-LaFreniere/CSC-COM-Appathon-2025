import React from "react";
import { View, StyleProp, ViewStyle, ImageBackground } from "react-native";

export type SystemPoint = { x: number; y: number; color: string };

export default function HumanWithDotsWeb({ points, style }: { points: SystemPoint[]; style?: StyleProp<ViewStyle> }) {
  // Calibrated inset bounds for R.jpg (percentage of container)
  // Adjust these if your silhouette image has different padding
  const BOUNDS = { left: 0.12, right: 0.12, top: 0.03, bottom: 0.03 };

  function toPos(pct: number, min: number, max: number) {
    return min + pct * (1 - min - max);
  }
  return (
    <View style={[{ flex: 1, position: "relative", overflow: "hidden" }, style] as any}>
      <ImageBackground
        source={require("../../assets/images/R.jpg")}
        resizeMode="contain"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {points.map((p, idx) => (
          <View
            key={idx}
            style={{
              position: "absolute",
              left: `${toPos(p.x, BOUNDS.left, BOUNDS.right) * 100}%`,
              top: `${toPos(p.y, BOUNDS.top, BOUNDS.bottom) * 100}%`,
              width: 28,
              height: 28,
              borderRadius: 28,
              marginLeft: -14,
              marginTop: -14,
              backgroundColor: p.color,
              opacity: 0.9,
            }}
          />
        ))}
      </ImageBackground>
    </View>
  );
}


