import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { theme } from "./theme";

const LOGO = require("./assets/burqanlogo.png");

export default function SplashScreen() {
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.25)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 42,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(barWidth, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.85,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.2,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [barWidth, glowOpacity, logoOpacity, logoScale]);

  const barAnimatedWidth = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ["12%", "72%"],
  });

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.glowOuter, { opacity: glowOpacity }]} />
      <Animated.View style={[styles.glowInner, { opacity: glowOpacity }]} />
      <Animated.Image
        source={LOGO}
        style={[
          styles.logo,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
        resizeMode="contain"
        accessibilityLabel="برقان"
      />
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: barAnimatedWidth }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bgSplash,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  glowOuter: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: theme.accentSoftCyan,
  },
  glowInner: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: theme.accentSoft,
  },
  logo: {
    width: 260,
    height: 120,
    zIndex: 2,
  },
  barTrack: {
    marginTop: 36,
    width: "70%",
    maxWidth: 220,
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(34, 211, 238, 0.2)",
    overflow: "hidden",
    zIndex: 2,
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: theme.accent2,
  },
});
