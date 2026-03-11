import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { LoadingState } from '../components/loading-state';
import { OfflineBanner } from '../components/offline-banner';
import { useAuth } from '../lib/auth/auth-context';
import { ForgotAccessScreen } from '../screens/forgot-access-screen';
import { HomeScreen } from '../screens/home-screen';
import { LoginScreen } from '../screens/login-screen';
import { OtpHelpScreen } from '../screens/otp-help-screen';
import { PoiNearbyScreen } from '../screens/poi-nearby-screen';
import { ResetAccessScreen } from '../screens/reset-access-screen';
import { SosScreen } from '../screens/sos-screen';
import { TripDetailScreen } from '../screens/trip-detail-screen';
import { TripsScreen } from '../screens/trips-screen';
import { theme } from '../theme/tokens';
import type {
  RiderAuthStackParamList,
  RiderRootStackParamList,
  RiderTabParamList,
  RiderTripsStackParamList,
} from './navigation.types';

const RootStack = createNativeStackNavigator<RiderRootStackParamList>();
const AuthStack = createNativeStackNavigator<RiderAuthStackParamList>();
const Tab = createBottomTabNavigator<RiderTabParamList>();
const TripsStack = createNativeStackNavigator<RiderTripsStackParamList>();

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
      <AuthStack.Screen name="ForgotAccess" component={ForgotAccessScreen} />
      <AuthStack.Screen name="ResetAccess" component={ResetAccessScreen} />
      <AuthStack.Screen name="OtpHelp" component={OtpHelpScreen} />
    </AuthStack.Navigator>
  );
}

// Wraps trips list/detail flows in a dedicated stack under the Trips tab.
function TripsStackNavigator() {
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
        options={{ title: 'Trips' }}
      />
      <TripsStack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ title: 'Trip Detail' }}
      />
    </TripsStack.Navigator>
  );
}

// Defines the authenticated rider tab shell used after successful login.
function RiderTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.caption,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen
        name="TripsStack"
        component={TripsStackNavigator}
        options={{ title: 'Trips' }}
      />
      <Tab.Screen name="SOS" component={SosScreen} options={{ title: 'SOS' }} />
      <Tab.Screen
        name="PoiNearby"
        component={PoiNearbyScreen}
        options={{ title: 'POIs' }}
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
