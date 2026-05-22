import React, { useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// A Pressable that springs to 0.97 on press — the standard Scout button feel.
// Confident spring (stiffness 300, damping 30), not bouncy. The animated
// transform lives on the Pressable itself so `style` (incl. flex) lays out normally.
export default function PressableScale({
  scaleTo = 0.97,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      stiffness: 300,
      damping: 30,
      mass: 1,
      useNativeDriver: true,
    }).start();

  const handlePressIn = (e: GestureResponderEvent) => {
    spring(scaleTo);
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    spring(1);
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
