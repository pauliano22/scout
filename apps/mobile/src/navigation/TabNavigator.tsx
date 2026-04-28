import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../theme/scoutTheme';
import DiscoverScreen from '../screens/DiscoverScreen';
import NetworkScreen from '../screens/NetworkScreen';
import YouScreen from '../screens/YouScreen';

const Tab = createBottomTabNavigator();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  iconActive: IoniconName;
  iconInactive: IoniconName;
  label: string;
  focused: boolean;
}

function TabIcon({ iconActive, iconInactive, label, focused }: TabIconProps) {
  return (
    <View style={styles.tabIconWrapper}>
      <Ionicons
        name={focused ? iconActive : iconInactive}
        size={24}
        color={focused ? colors.tabActive : colors.tabInactive}
      />
      <Text
        style={[styles.tabLabel, focused && styles.tabLabelFocused]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 56 + bottomPadding,
            paddingBottom: bottomPadding,
            paddingTop: 8,
          },
        ],
      }}
    >
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              iconActive="compass"
              iconInactive="compass-outline"
              label="Discover"
              focused={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Network"
        component={NetworkScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              iconActive="people"
              iconInactive="people-outline"
              label="Network"
              focused={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="You"
        component={YouScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              iconActive="person"
              iconInactive="person-outline"
              label="You"
              focused={focused}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.tabBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.tabBorder,
    ...Platform.select({
      ios: {
        shadowColor: 'transparent',
      },
      android: {
        elevation: 0,
      },
    }),
  },
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    gap: 2,
  },
  tabLabel: {
    ...typography.caption2,
    color: colors.tabInactive,
    fontWeight: '500',
    fontSize: 11,
  },
  tabLabelFocused: {
    color: colors.tabActive,
    fontWeight: '600',
  },
});
