import { publicVision } from '../public-vision';
export type Language = 'en' | 'ko';
export type Page = 'home' | 'privacy' | 'site-use' | '404';
export const identity = { origin: 'https://kcpalantir.tech', productURL: 'https://dc.kcpalantir.tech', email: 'kcpalantir@kcpalantir.tech', founder: 'KyungChan-Park' } as const;
export interface Copy {
  skip: string; navigation: string; signIn: string; language: string;
  titles: Record<Page, string>; descriptions: Record<Page, string>;
  headline: readonly string[]; intro: string; explore: string;
  spatialTitle: string; spatialDescription: string; spatialQuestion: string; spatialCaption: string; spatialSummary: string; spatialBody: string;
  inquirySections: readonly (readonly [string, string])[];
  relationshipSummary: string;
  geometryTitle: string; geometryDescription: string; geometryCaption: string; construction: string; constructionBody: string;
  productTitle: string; productBody: string; privateState: string; accessNote: string;
  visionTitle: string; visionHeading: string; visionBody: string; aiBoundary: string;
  founderTitle: string; founderLocation: string; founderBody: string; contactTitle: string; contactBody: string; emailAction: string;
  privacy: string; siteUse: string; legalStatus: string; home: string; missing: string;
  privacySections: readonly (readonly [string, string])[];
  useSections: readonly (readonly [string, string])[];
}
export const copy: Record<Language, Copy> = {
  en: {
    skip: 'Skip to content', navigation: 'Main navigation', signIn: 'Teacher sign-in', language: 'Language',
    titles: { home: 'mathCrew | Mathematics made thinkable', privacy: 'Privacy | mathCrew', 'site-use': 'Site use | mathCrew', '404': 'Page not found | mathCrew' },
    descriptions: { home: 'Independent mathematical reasoning through planned 3D thought experiments and real-world digital twins. A teacher-guided project founded in Seoul.', privacy: 'How the mathCrew public information site handles visits and email inquiries.', 'site-use': 'About this information site and the separate private dc teacher application.', '404': 'This page is not available. Return to mathCrew.' },
    headline: ['Mathematics', 'made thinkable.'],
    intro: publicVision.publicCopy.en.intro,
    explore: 'Explore the direction',
    spatialTitle: 'A plane through a unit cube',
    spatialDescription: 'An oblique projection of a unit cube. The plane x + y + z = 3/2 meets six cube edges, forming a hexagonal section. The shaded section is a static mathematical construction.',
    spatialQuestion: 'A plane moves. What changes?',
    spatialCaption: 'Planned direction / concept illustration, not a working digital twin.',
    spatialSummary: 'See the spatial construction',
    spatialBody: 'Inside a unit cube, x + y + z = 3/2 cuts a hexagon. Its vertices are the six permutations of (1, 1/2, 0). Move the plane parallel to itself: which sections become triangles? This is a static illustration of the questions we want learners to explore, not an available 3D tool.',
    relationshipSummary: 'Another relationship, in two dimensions',
    inquirySections: [
      ['Ask, explore, explain', 'The planned learning environment uses thoughtful questions and 3D thought experiments to develop independent reasoning. Real-world digital twins are a future direction for connecting mathematical models to familiar situations, not a delivered feature.'],
      ['Ground assistance in the lesson', 'Planned Claude-native inquiry would connect concept relationships and classroom context, helping teachers interpret learning evidence rather than handing learners a final answer. Claude API is not currently integrated.'],
      ['Evaluate before claiming', 'We plan to test conceptual understanding, learner independence, grounded reliability and the cost of assistance. No measured learning gains or outcome guarantees are claimed.'],
    ],
    geometryTitle: 'A circle, a point, a tangent',
    geometryDescription: 'A point at (3/5, 4/5) lies on the unit circle. Its radius meets the tangent at a right angle. A dashed line projects the point onto the horizontal axis.',
    geometryCaption: 'Mathematical illustration, not student data',
    construction: 'Inside the construction',
    constructionBody: 'On x² + y² = 1, the point P = (3/5, 4/5) gives the tangent 3x + 4y = 5. The radius and tangent are perpendicular. One relationship, several ways to see it.',
    productTitle: 'Student management, close to the classroom.',
    productBody: 'dc is the student-management application the founder uses in his own teaching. It is the first working application in the mathCrew project.',
    privateState: 'Current foundation: a private founder-use workspace.',
    accessNote: 'For existing authorized teachers. Sign-in opens the separate private application; access is not granted by this site.',
    visionTitle: 'In development', visionHeading: 'A question opens\na new dimension.',
    visionBody: 'The aim is conceptual understanding, not just an answer. Explore a construction, change an assumption, and explain the relationship that stays true.',
    aiBoundary: 'Teachers retain instructional and final educational judgment. Protect privacy, let learners reason. This public site provides no direct student AI access and collects no learning records.',
    founderTitle: 'Built from teaching.', founderLocation: 'Founder / Seoul, South Korea',
    founderBody: 'KyungChan-Park is a mathematics teacher building mathCrew from direct classroom experience. A small, founder-led project, with teaching practice as its starting point.',
    contactTitle: 'Let’s talk mathematics.', contactBody: 'Questions about the project or its direction? Contact the founder through the company mailbox. Please keep student information out of your message.', emailAction: 'Email the founder',
    privacy: 'Privacy', siteUse: 'Site use', legalStatus: 'mathCrew by kcpalantir. A founder-led mathematics project in Seoul.', home: 'Back to mathCrew', missing: 'Page not found',
    privacySections: [
      ['This information site', 'This site has no analytics scripts, tracking pixels, forms, uploads or sign-up flow. Fonts are served locally. Hosting infrastructure may process ordinary connection information under its own policies; this page does not claim that hosting logs are absent.'],
      ['Email inquiries', 'The email link opens your email application. If you write to us, your address and message are received through the company mailbox and used to answer your inquiry. Do not send student names, records or other sensitive information. Contact the same mailbox with privacy questions or deletion requests.'],
      ['The private teacher application', 'dc is a separate authenticated application. This landing page neither reads its student records nor changes its access controls. This notice covers the information site, not all processing in that application.'],
      ['Public development links', 'GitHub links open a separate public development host. GitHub may process connection information under its own policies when you follow a link. This site loads no GitHub assets and requests no GitHub login or provider permission. The links expose scoped reviewed source snapshots, not private records or live profile applications.'],
    ],
    useSections: [
      ['What is available', 'This website introduces mathCrew and links to the existing private dc teacher application. It is not an enrollment, purchase or access-granting service. Current use is a private founder-use pilot; future capabilities are identified as planned.'],
      ['Teaching and AI', 'Teachers retain final educational judgment. Claude API is not currently integrated. 3D thought experiments, real-world digital twins and Claude-native inquiry are planned, not delivered here. The mathematical constructions are concept illustrations, not a functioning product, screenshot or record of student outcomes.'],
      ['Operator and contact', 'mathCrew is a founder-led mathematics education project operated by kcpalantir and founded by KyungChan-Park in Seoul, South Korea. For questions about the site, use the company email below.'],
      ['Public source snapshots', 'The development section links to reviewed public code developed with AI assistance through Hermes. Source visibility is not a product sign-in, access grant, provider authorization or a claim that every profile is published or remote CI has passed. The package private field prevents npm publication; it does not make a GitHub repository private.'],
    ],
  },
  ko: {
    skip: '본문으로 건너뛰기', navigation: '주요 메뉴', signIn: '교사 로그인', language: '언어',
    titles: { home: 'mathCrew | 생각할 수 있는 수학', privacy: '개인정보 안내 | mathCrew', 'site-use': '사이트 이용 안내 | mathCrew', '404': '페이지를 찾을 수 없습니다 | mathCrew' },
    descriptions: { home: '스스로 추론하는 힘을 위한 수학 학습 환경. 3D 사고실험과 현실 세계의 디지털 트윈을 교사 주도의 탐구로 연결하는 것이 계획입니다.', privacy: 'mathCrew 소개 사이트의 방문 및 이메일 문의에 관한 개인정보 안내.', 'site-use': '소개 사이트와 별도로 운영되는 비공개 dc 교사 앱의 이용 범위.', '404': '요청한 페이지가 없습니다. mathCrew로 돌아가세요.' },
    headline: ['생각할 수 있는', '수학.'],
    intro: publicVision.publicCopy.ko.intro, explore: '앞으로의 방향 살펴보기',
    spatialTitle: '정육면체를 지나는 평면',
    spatialDescription: '단위 정육면체를 공간에서 비스듬히 투영한 그림입니다. 평면 x + y + z = 3/2가 여섯 모서리를 만나 육각형 단면을 만듭니다. 색칠된 단면은 정적인 수학 구성입니다.',
    spatialQuestion: '평면이 움직이면 무엇이 달라질까요?',
    spatialCaption: '계획된 방향의 개념 그림이며, 작동하는 디지털 트윈이 아닙니다.',
    spatialSummary: '공간 속 구성 살펴보기',
    spatialBody: '단위 정육면체에서 x + y + z = 3/2는 육각형 단면을 만듭니다. 꼭짓점은 (1, 1/2, 0)의 여섯 순열입니다. 평면을 평행하게 옮기면 언제 삼각형 단면이 될까요? 학습자가 탐구할 질문을 담은 정적인 그림이며, 현재 이용할 수 있는 3D 도구가 아닙니다.',
    relationshipSummary: '평면에서도 관계 살펴보기',
    inquirySections: [
      ['질문하고, 탐색하고, 설명하기', '계획 중인 학습 환경은 생각을 이끄는 질문과 3D 사고실험으로 독립적인 추론을 기르는 것이 목표입니다. 현실 세계의 디지털 트윈으로 수학 모형을 익숙한 상황과 연결하는 것은 향후 방향이며, 제공 중인 기능이 아닙니다.'],
      ['수업의 근거에 연결하기', '계획된 Claude 기반 탐구 지원은 개념의 관계와 수업 맥락을 연결해 교사가 학습의 근거를 해석하도록 돕는 방향입니다. 학습자에게 정답을 대신 주는 도구가 아닙니다. Claude API는 아직 통합되어 있지 않습니다.'],
      ['평가한 뒤에 이야기하기', '개념 이해, 학습자의 독립적인 추론, 근거에 기반한 신뢰성, 지원 비용을 평가할 계획입니다. 측정된 학습 향상이나 성과 보장을 주장하지 않습니다.'],
    ],
    geometryTitle: '원과 한 점, 그리고 접선', geometryDescription: '단위원 위의 점 (3/5, 4/5)에서 반지름과 접선은 직각으로 만납니다. 점선은 그 점을 가로축으로 내려 연결합니다.', geometryCaption: '수학적 관계를 그린 그림이며 학생 데이터가 아닙니다', construction: '그림 속 수학 보기', constructionBody: 'x² + y² = 1 위의 점 P = (3/5, 4/5)에서 접선은 3x + 4y = 5입니다. 반지름과 접선은 수직입니다. 하나의 관계를 여러 관점으로 살펴봅니다.',
    productTitle: '교실 가까이에서 시작한 학생 관리.', productBody: 'dc는 창업자가 실제 수업에서 직접 사용하는 학생 관리 앱입니다. mathCrew 프로젝트의 첫 번째 작동하는 앱입니다.', privateState: '현재의 기반은 창업자가 직접 사용하는 비공개 작업 공간입니다.', accessNote: '기존에 접근 권한을 가진 교사용입니다. 로그인은 별도의 비공개 앱으로 연결되며, 이 사이트에서 이용 권한을 부여하지 않습니다.',
    visionTitle: '개발 중인 방향', visionHeading: '질문 하나가\n새 차원을 엽니다.', visionBody: '정답만 얻는 것이 아니라 개념을 이해하는 것이 목표입니다. 구성을 탐색하고 가정을 바꾸며, 그 안에서 변하지 않는 관계를 스스로 설명합니다.', aiBoundary: '수업과 교육에 관한 최종 판단은 교사가 맡습니다. 개인정보를 보호하고 학습자가 스스로 추론하도록 돕습니다. 이 소개 사이트는 학생에게 직접 AI 접근을 제공하거나 학습 기록을 수집하지 않습니다.',
    founderTitle: '가르치는 경험에서 출발합니다.', founderLocation: '창업자 / 대한민국 서울', founderBody: 'KyungChan-Park는 수학을 가르치며 mathCrew를 만드는 창업자입니다. 직접 겪은 수업의 필요에서 출발한 작은 창업자 중심 프로젝트입니다.', contactTitle: '수학 교육에 관해 이야기해요.', contactBody: '프로젝트나 앞으로의 방향이 궁금하다면 회사 이메일로 문의해 주세요. 학생의 개인정보는 메시지에 포함하지 마세요.', emailAction: '창업자에게 이메일 보내기',
    privacy: '개인정보 안내', siteUse: '사이트 이용 안내', legalStatus: 'mathCrew는 서울에서 창업자가 직접 만드는 kcpalantir의 수학 교육 프로젝트입니다.', home: 'mathCrew로 돌아가기', missing: '페이지를 찾을 수 없습니다',
    privacySections: [
      ['소개 사이트', '이 사이트에는 분석 스크립트, 추적 픽셀, 입력 양식, 업로드 또는 가입 절차가 없습니다. 글꼴은 같은 사이트에서 제공합니다. 호스팅 서비스는 자체 정책에 따라 일반적인 접속 정보를 처리할 수 있으며, 호스팅 로그가 없다고 주장하지 않습니다.'],
      ['이메일 문의', '이메일 링크는 사용자의 메일 앱을 엽니다. 문의하면 이메일 주소와 메시지가 회사 메일함에 전달되며 답변을 위해 사용됩니다. 학생 이름, 기록이나 민감한 정보를 보내지 마세요. 개인정보 관련 질문이나 삭제 요청도 같은 이메일로 문의할 수 있습니다.'],
      ['비공개 교사 앱', 'dc는 별도의 인증이 필요한 앱입니다. 이 소개 사이트는 학생 기록을 읽거나 앱의 접근 권한을 변경하지 않습니다. 이 안내는 소개 사이트에 관한 것이며, 해당 앱의 모든 정보 처리를 포괄하지 않습니다.'],
      ['공개 개발 링크', 'GitHub 링크는 별도의 공개 개발 호스트로 연결됩니다. 링크를 따라가면 GitHub가 자체 정책에 따라 접속 정보를 처리할 수 있습니다. 이 사이트는 GitHub 리소스를 불러오거나 GitHub 로그인 및 제공자 권한을 요청하지 않습니다. 링크는 검토한 공개 소스 스냅샷이며 비공개 기록이나 실행 중인 프로필 앱이 아닙니다.'],
    ],
    useSections: [
      ['현재 이용 범위', '이 사이트는 mathCrew를 소개하고 기존 비공개 dc 교사 앱으로 연결합니다. 등록, 구매 또는 접근 권한 부여 서비스가 아닙니다. 현재는 창업자가 직접 사용하는 비공개 파일럿이며, 앞으로의 기능은 계획으로 구분해 안내합니다.'],
      ['교육적 판단과 AI', '교육에 관한 최종 판단은 교사에게 있습니다. Claude API는 아직 통합되어 있지 않습니다. 3D 사고실험, 현실 세계의 디지털 트윈과 Claude 기반 탐구 지원은 향후 계획입니다. 수학 그림은 개념을 보여주는 표현이며, 작동하는 제품이나 앱 화면, 학생의 성과 기록이 아닙니다.'],
      ['운영자와 연락처', 'mathCrew는 대한민국 서울의 KyungChan-Park가 창업하고 kcpalantir가 운영하는 수학 교육 프로젝트입니다. 사이트에 관한 질문은 아래 회사 이메일로 문의해 주세요.'],
      ['공개 소스 스냅샷', '개발 섹션은 Hermes에서 AI의 도움으로 개발하고 검토한 공개 코드로 연결됩니다. 소스 공개는 제품 로그인, 접근 권한 부여 또는 제공자 인증이 아니며, 모든 프로필의 공개 완료나 원격 CI 성공을 뜻하지 않습니다. 패키지의 private 필드는 npm 배포를 막는 설정이며 GitHub 저장소를 비공개로 만드는 설정이 아닙니다.'],
    ],
  },
};
