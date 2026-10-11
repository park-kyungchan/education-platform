import type {PostgresAcademyStore} from './postgresStore';
import {TeacherApplication} from './application';
import {SourceRefreshCoordinator} from './refresh';
import {createNativeDirectBookAcquirer,createNativeDirectReadAcquirer,type AcademySourceConnection,type DirectBookRuntime} from './nativeConnector';

/** Shared composition used by selected main and isolated consumer tests; construction performs no acquisition. */
export function createTeacherSourceRuntime(store:PostgresAcademyStore,config:DirectBookRuntime&{ownerId:string},receiver?:Parameters<typeof createNativeDirectBookAcquirer>[1],readReceiver?:Parameters<typeof createNativeDirectReadAcquirer>[1]){
 const source=createNativeDirectBookAcquirer(config,receiver);
 const areas=createNativeDirectReadAcquirer(config,readReceiver);
 const connection=():AcademySourceConnection=>{const base=source.connection();return {...base,acquisition:{...base.acquisition,scope:'registered_books_and_retained_exact_scopes',families:['student_course','day_record','textbook','daily_zero'],lastObservedAtScope:'book_registration'}};};
 const app=new TeacherApplication(store,config.ownerId,connection);
 const coordinator=new SourceRefreshCoordinator(store,config,source.acquire,areas.acquire);
 return {app,coordinator,connection,close:async()=>{await Promise.all([source.close(),areas.close()]);}};
}
