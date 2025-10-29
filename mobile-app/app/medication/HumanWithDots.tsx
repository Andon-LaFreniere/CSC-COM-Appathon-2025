import React from "react";
import { Platform, StyleProp, ViewStyle } from "react-native";
import HumanWithDotsWeb from "./HumanWithDots.web";
import HumanWithDotsNative from "./HumanWithDots.native";

export type SystemPoint = { x: number; y: number; color: string };

type Props = { points: SystemPoint[]; style?: StyleProp<ViewStyle> };

export default function HumanWithDots(props: Props) {
  if (Platform.OS === "web") return <HumanWithDotsWeb {...props} />;
  return <HumanWithDotsNative {...props} />;
}
