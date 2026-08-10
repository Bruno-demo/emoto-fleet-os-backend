import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { LoadingState } from '../components/loading-state';
import { OfflineBanner } from '../components/offline-banner';
import { useAuth } from '../lib/auth/auth-context';
import { ForgotAccessScreen } from '../screens/forgot-access-screen';
import { HomeScreen } from '../screens/home-screen';
import { LoginScreen } from '../screens/login-screen';
import { OtpHelpScreen } from '../screens/otp-help-screen';
import { RegisterScreen } from '../screens/register-screen';
import { PoiNearbyScreen } from '../screens/poi-nearby-screen';
import { ProfileScreen } from '../screens/profile-screen';
import { ResetAccessScreen } from '../screens/reset-access-screen';
import { SosScreen } from '../screens/sos-screen';
import { TripDetailScreen } from '../screens/trip-detail-screen';
import { TripsScreen } from '../screens/trips-screen';
import { DeliveriesScreen } from '../screens/deliveries-screen';
import { DeliveryDetailScreen } from '../screens/delivery-detail-screen';
import { PaymentsScreen } from '../screens/payments-screen';
import { theme } from '../theme/tokens';
import type {
  RiderAuthStackParamList,
  RiderRootStackParamList,
  RiderTabParamList,
  RiderTripsStackParamList,
  RiderDeliveriesStackParamList,
} from './navigation.types';

const RootStack = createNativeStackNavigator<RiderRootStackParamList>();
const AuthStack = createNativeStackNavigator<RiderAuthStackParamList>();
const Tab = createBottomTabNavigator<RiderTabParamList>();
const TripsStack = createNativeStackNavigator<RiderTripsStackParamList>();
const DeliveriesStack = createNativeStackNavigator<RiderDeliveriesStackParamList>();

function getTabIconName(
  routeName: keyof RiderTabParamList,
  focused: boolean,
): keyof typeof Ionicons.glyphMap {
  if (routeName === 'Home') {
    return focused ? 'speedometer' : 'speedometer-outline';
  }
  if (routeName === 'TripsStack') {
    return focused ? 'map' : 'map-outline';
  }
  if (routeName === 'DeliveriesStack') {
    return focused ? 'cube' : 'cube-outline';
  }
  if (routeName === 'Payments') {
    return focused ? 'card' : 'card-outline';
  }
  if (routeName === 'SOS') {
    return focused ? 'warning' : 'warning-outline';
  }
  if (routeName === 'Profile') {
    return focused ? 'person-circle' : 'person-circle-outline';
  }
  return focused ? 'navigate' : 'navigate-outline';
}

import { useLanguage } from '../lib/i18n/language-context';

function DeliveriesStackNavigator() {
  const { t } = useLanguage();
  return (
    <DeliveriesStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <DeliveriesStack.Screen
        name="DeliveriesList"
        component={DeliveriesScreen}
        options={{ title: t.deliveries.title }}
      />
      <DeliveriesStack.Screen
        name="DeliveryDetail"
        component={DeliveryDetailScreen}
        options={{ title: t.deliveries.orderDetailTitle }}
      />
    </DeliveriesStack.Navigator>
  );
}

// Keeps unauthenticated rider help and recovery screens inside a dedicated auth stack.
function AuthStackNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotAccess" component={ForgotAccessScreen} />
      <AuthStack.Screen name="ResetAccess" component={ResetAccessScreen} />
      <AuthStack.Screen name="OtpHelp" component={OtpHelpScreen} />
    </AuthStack.Navigator>
  );
}

// Wraps trips list/detail flows in a dedicated stack under the Trips tab.
function TripsStackNavigator() {
  const { t } = useLanguage();
  return (
    <TripsStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <TripsStack.Screen
        name="TripsList"
        component={TripsScreen}
        options={{ title: t.trips.title }}
      />
      <TripsStack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ title: t.trips.tripDetailTitle }}
      />
    </TripsStack.Navigator>
  );
}

// Defines the authenticated rider tab shell used after successful login.
function RiderTabsNavigator() {
  const { t } = useLanguage();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            color={color}
            size={size}
            name={getTabIconName(route.name, focused)}
          />
        ),
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          height: 76,
          paddingTop: 10,
          paddingBottom: 14,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.caption,
          fontWeight: '700',
          marginTop: 2,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t.tabs.home }} />
      <Tab.Screen
        name="TripsStack"
        component={TripsStackNavigator}
        options={{ title: t.tabs.trips }}
      />
      <Tab.Screen
        name="DeliveriesStack"
        component={DeliveriesStackNavigator}
        options={{ title: t.tabs.deliveries }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{ title: t.tabs.payments }}
      />
      <Tab.Screen name="SOS" component={SosScreen} options={{ title: t.tabs.sos }} />
      <Tab.Screen
        name="PoiNearby"
        component={PoiNearbyScreen}
        options={{ title: t.tabs.nearby }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t.tabs.profile }}
      />
    </Tab.Navigator>
  );
}

// Chooses auth/login navigation tree based on persisted rider session state.
export function RootNavigator() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return <LoadingState message="Restoring rider session..." />;
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {auth.status === 'authenticated' ? (
          <RootStack.Screen name="App" component={RiderTabsNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthStackNavigator} />
        )}
      </RootStack.Navigator>
    </View>
  );
}
