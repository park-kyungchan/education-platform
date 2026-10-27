/** Actual current consumer capabilities, not source freshness or an effect grant. */
export const academyConnectionStatus=Object.freeze({
  schemaVersion:1,
  retainedQuery:'available',
  acquisition:Object.freeze({transport:'direct_http_api',state:'blocked',reason:'direct_http_authentication_not_qualified',browserFallback:false}),
  officialJournalSave:'not_implemented',
  parentSend:'teacher_owned',
} as const);

export interface AcademySourceConnection {
  schemaVersion:1;retainedQuery:'available';officialJournalSave:'not_implemented';parentSend:'teacher_owned';
  acquisition:{transport:'direct_http_api';state:'blocked'|'available';reason:string;browserFallback:false;scope?:'registered_course_book_only'|'registered_books_and_retained_exact_scopes';families?:readonly string[];lastObservedAtScope?:'book_registration';authentication?:'fresh_per_explicit_request';lastObservedAt?:string|null};
}
