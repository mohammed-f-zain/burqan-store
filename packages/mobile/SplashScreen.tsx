import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";

import { theme } from "./theme";

const LOGO = require("./assets/burqanlogo.png");

export default function SplashScreen() {
  const scale = useRef(new Animated.Value(0.92)).current;
  const glowOpacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.7,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.25,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [glowOpacity, scale]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
      <Animated.View style={[styles.logoWrap, { transform: [{ scale }] }]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="برقان" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bgSplash,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  glow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(37, 99, 235, 0.35)",
  },
  logoWrap: {
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 300,
    height: 140,
  },
});
