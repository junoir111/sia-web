import React from 'react';
import {
  Outlet,
  Route,
  createBrowserRouter,
  createHashRouter,
  createRoutesFromElements,
  redirect,
  Navigate,
} from 'react-router-dom';

import { ClientConfig } from '../hooks/useClientConfig';
import { AuthLayout, Login, Register, ResetPassword } from './auth';
import { LOGIN_PATH, REGISTER_PATH, RESET_PASSWORD_PATH } from './paths';
import { getAppPathFromHref, getLoginPath, getOriginBaseUrl } from './pathUtils';
import { ClientBindAtoms, ClientLayout, ClientRoot } from './client';
import { SiaProfileGate } from '../sia/SiaProfileGate';
import { SiaEphemeralSweeper } from '../sia/SiaEphemeralSweeper';
import { SiaWall } from '../sia/SiaWall';
import { SiaBulle } from '../sia/SiaBulle';
import { SIA_BULLE_PATH, SIA_WALL_PATH } from '../sia/paths';
import { setAfterLoginRedirectPath } from './afterLoginRedirectPath';
import { SidebarNav } from './client/SidebarNav';
import { MobileFriendlyClientNav } from './MobileFriendly';
import { ClientInitStorageAtom } from './client/ClientInitStorageAtom';
import { ClientNonUIFeatures } from './client/ClientNonUIFeatures';
import { AuthRouteThemeManager, UnAuthRouteThemeManager } from './ThemeManager';
import { ReceiveSelfDeviceVerification } from '../components/DeviceVerification';
import { AutoRestoreBackupOnVerification } from '../components/BackupRestore';
import { RoomSettingsRenderer } from '../features/room-settings';
import { ClientRoomsNotificationPreferences } from './client/ClientRoomsNotificationPreferences';
import { SpaceSettingsRenderer } from '../features/space-settings';
import { UserRoomProfileRenderer } from '../components/UserRoomProfileRenderer';
import { CreateRoomModalRenderer } from '../features/create-room';
import { CreateSpaceModalRenderer } from '../features/create-space';
import { getFallbackSession } from '../state/sessions';
import { CallStatusRenderer } from './CallStatusRenderer';
import { CallEmbedProvider } from '../components/CallEmbedProvider';

export const createRouter = (clientConfig: ClientConfig) => {
  const { hashRouter } = clientConfig;

  const routes = createRoutesFromElements(
    <Route>
      <Route
        index
        loader={() => {
          if (getFallbackSession()) return redirect(SIA_WALL_PATH);
          const afterLoginPath = getAppPathFromHref(getOriginBaseUrl(), window.location.href);
          if (afterLoginPath) setAfterLoginRedirectPath(afterLoginPath);
          return redirect(getLoginPath());
        }}
      />
      <Route
        loader={() => {
          if (getFallbackSession()) {
            return redirect(SIA_WALL_PATH);
          }

          return null;
        }}
        element={
          <>
            <AuthLayout />
            <UnAuthRouteThemeManager />
          </>
        }
      >
        <Route path={LOGIN_PATH} element={<Login />} />
        <Route path={REGISTER_PATH} element={<Register />} />
        <Route path={RESET_PASSWORD_PATH} element={<ResetPassword />} />
      </Route>

      <Route
        loader={() => {
          const session = getFallbackSession();
          if (!session) {
            const afterLoginPath = getAppPathFromHref(
              getOriginBaseUrl(hashRouter),
              window.location.href
            );
            if (afterLoginPath) setAfterLoginRedirectPath(afterLoginPath);
            return redirect(getLoginPath());
          }
          return null;
        }}
        element={
          <AuthRouteThemeManager>
            <ClientRoot>
              <ClientInitStorageAtom>
                <ClientRoomsNotificationPreferences>
                  <ClientBindAtoms>
                    <ClientNonUIFeatures>
                      <CallEmbedProvider>
                        <SiaProfileGate>
                          <ClientLayout
                            nav={
                              <MobileFriendlyClientNav>
                                <SidebarNav />
                              </MobileFriendlyClientNav>
                            }
                          >
                            <Outlet />
                          </ClientLayout>
                        </SiaProfileGate>
                        <SiaEphemeralSweeper />
                        <CallStatusRenderer />
                      </CallEmbedProvider>
                      <UserRoomProfileRenderer />
                      <CreateRoomModalRenderer />
                      <CreateSpaceModalRenderer />
                      <RoomSettingsRenderer />
                      <SpaceSettingsRenderer />
                      <ReceiveSelfDeviceVerification />
                      <AutoRestoreBackupOnVerification />
                    </ClientNonUIFeatures>
                  </ClientBindAtoms>
                </ClientRoomsNotificationPreferences>
              </ClientInitStorageAtom>
            </ClientRoot>
          </AuthRouteThemeManager>
        }
      >
        <Route path={SIA_WALL_PATH} element={<SiaWall />} />
        <Route path={SIA_BULLE_PATH} element={<SiaBulle />} />
        {/* SIA: the original Cinny screens are removed; anything else goes back to the wall. */}
        <Route path="*" element={<Navigate to={SIA_WALL_PATH} replace />} />
      </Route>
      <Route path="/*" element={<p>Page not found</p>} />
    </Route>
  );

  if (hashRouter?.enabled) {
    return createHashRouter(routes, { basename: hashRouter.basename });
  }
  return createBrowserRouter(routes, {
    basename: import.meta.env.BASE_URL,
  });
};
