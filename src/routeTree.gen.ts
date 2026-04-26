/* eslint-disable */

import { Route as rootRouteImport } from "./routes/__root";
import { Route as IndexRouteImport } from "./routes/index";
import { Route as RecordsRouteImport } from "./routes/records";
import { Route as ItemsItemIdRouteImport } from "./routes/items.$itemId";
import { Route as SettingsRouteImport } from "./routes/settings";
import { Route as SyncRouteImport } from "./routes/sync";

const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => rootRouteImport } as any);
const RecordsRoute = RecordsRouteImport.update({ id: '/records', path: '/records', getParentRoute: () => rootRouteImport } as any);
const ItemsItemIdRoute = ItemsItemIdRouteImport.update({ id: '/items/$itemId', path: '/items/$itemId', getParentRoute: () => rootRouteImport } as any);
const SettingsRoute = SettingsRouteImport.update({ id: '/settings', path: '/settings', getParentRoute: () => rootRouteImport } as any);
const SyncRoute = SyncRouteImport.update({ id: '/sync', path: '/sync', getParentRoute: () => rootRouteImport } as any);

export interface FileRoutesByFullPath { '/': typeof IndexRoute; '/records': typeof RecordsRoute; '/items/$itemId': typeof ItemsItemIdRoute; '/settings': typeof SettingsRoute; '/sync': typeof SyncRoute }
export interface FileRoutesByTo { '/': typeof IndexRoute; '/records': typeof RecordsRoute; '/items/$itemId': typeof ItemsItemIdRoute; '/settings': typeof SettingsRoute; '/sync': typeof SyncRoute }
export interface FileRoutesById { __root__: typeof rootRouteImport; '/': typeof IndexRoute; '/records': typeof RecordsRoute; '/items/$itemId': typeof ItemsItemIdRoute; '/settings': typeof SettingsRoute; '/sync': typeof SyncRoute }
export interface FileRouteTypes { fileRoutesByFullPath: FileRoutesByFullPath; fullPaths: '/' | '/records' | '/items/$itemId' | '/settings' | '/sync'; fileRoutesByTo: FileRoutesByTo; to: '/' | '/records' | '/items/$itemId' | '/settings' | '/sync'; id: '__root__' | '/' | '/records' | '/items/$itemId' | '/settings' | '/sync'; fileRoutesById: FileRoutesById }
export interface RootRouteChildren { IndexRoute: typeof IndexRoute; RecordsRoute: typeof RecordsRoute; ItemsItemIdRoute: typeof ItemsItemIdRoute; SettingsRoute: typeof SettingsRoute; SyncRoute: typeof SyncRoute }

declare module '@tanstack/react-router' { interface FileRoutesByPath { '/': { id: '/'; path: '/'; fullPath: '/'; preLoaderRoute: typeof IndexRouteImport; parentRoute: typeof rootRouteImport }; '/records': { id: '/records'; path: '/records'; fullPath: '/records'; preLoaderRoute: typeof RecordsRouteImport; parentRoute: typeof rootRouteImport }; '/items/$itemId': { id: '/items/$itemId'; path: '/items/$itemId'; fullPath: '/items/$itemId'; preLoaderRoute: typeof ItemsItemIdRouteImport; parentRoute: typeof rootRouteImport }; '/settings': { id: '/settings'; path: '/settings'; fullPath: '/settings'; preLoaderRoute: typeof SettingsRouteImport; parentRoute: typeof rootRouteImport }; '/sync': { id: '/sync'; path: '/sync'; fullPath: '/sync'; preLoaderRoute: typeof SyncRouteImport; parentRoute: typeof rootRouteImport } } }

const rootRouteChildren: RootRouteChildren = { IndexRoute: IndexRoute, RecordsRoute: RecordsRoute, ItemsItemIdRoute: ItemsItemIdRoute, SettingsRoute: SettingsRoute, SyncRoute: SyncRoute };
export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>();
