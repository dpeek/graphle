import type {
  AuthSubjectRef as RootAuthSubjectRef,
  AuthenticatedSession as RootAuthenticatedSession,
  GraphCommandSpec as RootGraphCommandSpec,
  ModulePermissionApprovalRecord as RootModulePermissionApprovalRecord,
  ModulePermissionRequest as RootModulePermissionRequest,
  ObjectViewSpec as RootObjectViewSpec,
  WebPrincipalBootstrapPayload as RootWebPrincipalBootstrapPayload,
  WebPrincipalSession as RootWebPrincipalSession,
  WebPrincipalSummary as RootWebPrincipalSummary,
  WorkflowSpec as RootWorkflowSpec,
} from "../index.js";
import type {
  AuthSubjectRef,
  AuthenticatedSession,
  GraphCommandSpec,
  ModulePermissionApprovalRecord,
  ModulePermissionRequest,
  ObjectViewSpec,
  WebPrincipalBootstrapPayload,
  WebPrincipalSession,
  WebPrincipalSummary,
  WorkflowSpec,
} from "./index.js";

const topicSummaryView = {
  key: "pkm:topic:summary",
  entity: "pkm:topic",
  titleField: "name",
  subtitleField: "kind",
  sections: [
    {
      key: "summary",
      title: "Summary",
      fields: [
        { path: "name", label: "Name", span: 2 },
        { path: "kind", label: "Kind" },
      ],
    },
  ],
  related: [
    {
      key: "references",
      title: "References",
      relationPath: "references",
      presentation: "list",
    },
  ],
  commands: ["pkm:topic:save"],
} satisfies ObjectViewSpec;

const topicReviewWorkflow = {
  key: "pkm:topic:review",
  label: "Review topic",
  description: "Review and update a topic.",
  subjects: ["pkm:topic"],
  steps: [
    {
      key: "review",
      title: "Review details",
      objectView: topicSummaryView.key,
    },
    {
      key: "save",
      title: "Save changes",
      command: "pkm:topic:save",
    },
  ],
  commands: ["pkm:topic:save"],
} satisfies WorkflowSpec;

const saveTopicCommand = {
  key: "pkm:topic:save",
  label: "Save topic",
  subject: "pkm:topic",
  execution: "optimisticVerify",
  input: {
    title: "Document graph explorer affordances",
  },
  output: {
    topicId: "topic-1",
  },
  policy: {
    capabilities: ["topic.write"],
    touchesPredicates: [{ predicateId: "pkm:topic.name" }, { predicateId: "pkm:topic.content" }],
  },
} satisfies GraphCommandSpec<{ title: string }, { topicId: string }>;

const readTopicPermission = {
  key: "pkm.topic.read.summary",
  kind: "predicate-read",
  predicateIds: ["pkm:topic.name", "pkm:topic.content"],
  reason: "Read topic summary data during install-planned views.",
  required: true,
} satisfies ModulePermissionRequest;

const saveTopicPermission = {
  key: "pkm.topic.command.save",
  kind: "command-execute",
  commandKeys: [saveTopicCommand.key],
  touchesPredicates: ["pkm:topic.name", "pkm:topic.content"],
  reason: "Execute the topic save command from a module workflow.",
  required: true,
} satisfies ModulePermissionRequest;

const blobPreviewPermission = {
  key: "pkm.topic.blob.preview",
  kind: "blob-class",
  blobClassKeys: ["preview-image"],
  reason: "Access derived blob previews for topic cards.",
  required: false,
} satisfies ModulePermissionRequest;

const authSubject = {
  issuer: "better-auth",
  provider: "github",
  providerAccountId: "acct-1",
  authUserId: "auth-user-1",
} satisfies AuthSubjectRef;

const authenticatedSession = {
  sessionId: "session-1",
  subject: authSubject,
} satisfies AuthenticatedSession;

const webPrincipalSession = {
  authState: "ready",
  sessionId: authenticatedSession.sessionId,
  principalId: "principal-1",
  capabilityVersion: 3,
  displayName: "Operator",
} satisfies WebPrincipalSession;

const webPrincipalSummary = {
  graphId: "graph-1",
  principalId: "principal-1",
  principalKind: "human",
  roleKeys: ["graph:member"],
  capabilityGrantIds: ["grant-1"],
  access: {
    authority: false,
    graphMember: true,
    sharedRead: false,
  },
  capabilityVersion: 3,
  policyVersion: 5,
} satisfies WebPrincipalSummary;

const webPrincipalBootstrapPayload = {
  session: webPrincipalSession,
  principal: webPrincipalSummary,
} satisfies WebPrincipalBootstrapPayload;

const approvedModulePermissionRecord = {
  moduleId: "pkm.topic",
  permissionKey: readTopicPermission.key,
  request: readTopicPermission,
  status: "approved",
  decidedAt: "2026-03-24T00:00:00.000Z",
  decidedByPrincipalId: "principal:operator",
  lowerings: [
    {
      kind: "capability-grant",
      grant: {
        id: "grant-module-1",
        resource: {
          kind: "module-permission",
          permissionKey: readTopicPermission.key,
        },
        target: {
          kind: "principal",
          principalId: "principal-1",
        },
        grantedByPrincipalId: "principal:operator",
        status: "active",
        issuedAt: "2026-03-24T00:00:00.000Z",
      },
    },
    {
      kind: "role-binding",
      binding: {
        id: "binding-1",
        principalId: "principal-1",
        roleKey: "graph:member",
        status: "active",
      },
    },
  ],
} satisfies ModulePermissionApprovalRecord;

const rootObjectView: RootObjectViewSpec = topicSummaryView;
const rootWorkflow: RootWorkflowSpec = topicReviewWorkflow;
const rootCommand: RootGraphCommandSpec<{ title: string }, { topicId: string }> = saveTopicCommand;
const rootReadPermission: RootModulePermissionRequest = readTopicPermission;
const rootSavePermission: RootModulePermissionRequest = saveTopicPermission;
const rootBlobPermission: RootModulePermissionRequest = blobPreviewPermission;
const rootAuthSubject: RootAuthSubjectRef = authSubject;
const rootAuthenticatedSession: RootAuthenticatedSession = authenticatedSession;
const rootWebPrincipalSession: RootWebPrincipalSession = webPrincipalSession;
const rootWebPrincipalSummary: RootWebPrincipalSummary = webPrincipalSummary;
const rootWebPrincipalBootstrapPayload: RootWebPrincipalBootstrapPayload =
  webPrincipalBootstrapPayload;
const rootApprovedRecord: RootModulePermissionApprovalRecord = approvedModulePermissionRecord;

const runtimeObjectView: ObjectViewSpec = rootObjectView;
const runtimeWorkflow: WorkflowSpec = rootWorkflow;
const runtimeCommand: GraphCommandSpec<{ title: string }, { topicId: string }> = rootCommand;
const runtimeReadPermission: ModulePermissionRequest = rootReadPermission;
const runtimeSavePermission: ModulePermissionRequest = rootSavePermission;
const runtimeBlobPermission: ModulePermissionRequest = rootBlobPermission;
const runtimeAuthSubject: AuthSubjectRef = rootAuthSubject;
const runtimeAuthenticatedSession: AuthenticatedSession = rootAuthenticatedSession;
const runtimeWebPrincipalSession: WebPrincipalSession = rootWebPrincipalSession;
const runtimeWebPrincipalSummary: WebPrincipalSummary = rootWebPrincipalSummary;
const runtimeWebPrincipalBootstrapPayload: WebPrincipalBootstrapPayload =
  rootWebPrincipalBootstrapPayload;
const runtimeApprovedRecord: ModulePermissionApprovalRecord = rootApprovedRecord;

const rootObjectViewRoundTrip: RootObjectViewSpec = runtimeObjectView;
const rootWorkflowRoundTrip: RootWorkflowSpec = runtimeWorkflow;
const rootCommandRoundTrip: RootGraphCommandSpec<{ title: string }, { topicId: string }> =
  runtimeCommand;
const rootReadPermissionRoundTrip: RootModulePermissionRequest = runtimeReadPermission;
const rootSavePermissionRoundTrip: RootModulePermissionRequest = runtimeSavePermission;
const rootBlobPermissionRoundTrip: RootModulePermissionRequest = runtimeBlobPermission;
const rootAuthSubjectRoundTrip: RootAuthSubjectRef = runtimeAuthSubject;
const rootAuthenticatedSessionRoundTrip: RootAuthenticatedSession = runtimeAuthenticatedSession;
const rootWebPrincipalSessionRoundTrip: RootWebPrincipalSession = runtimeWebPrincipalSession;
const rootWebPrincipalSummaryRoundTrip: RootWebPrincipalSummary = runtimeWebPrincipalSummary;
const rootWebPrincipalBootstrapPayloadRoundTrip: RootWebPrincipalBootstrapPayload =
  runtimeWebPrincipalBootstrapPayload;
const rootApprovedRecordRoundTrip: RootModulePermissionApprovalRecord = runtimeApprovedRecord;

void topicSummaryView;
void topicReviewWorkflow;
void saveTopicCommand;
void readTopicPermission;
void saveTopicPermission;
void blobPreviewPermission;
void authSubject;
void authenticatedSession;
void webPrincipalSession;
void webPrincipalSummary;
void webPrincipalBootstrapPayload;
void approvedModulePermissionRecord;
void rootObjectView;
void rootWorkflow;
void rootCommand;
void rootReadPermission;
void rootSavePermission;
void rootBlobPermission;
void rootAuthSubject;
void rootAuthenticatedSession;
void rootWebPrincipalSession;
void rootWebPrincipalSummary;
void rootWebPrincipalBootstrapPayload;
void rootApprovedRecord;
void runtimeObjectView;
void runtimeWorkflow;
void runtimeCommand;
void runtimeReadPermission;
void runtimeSavePermission;
void runtimeBlobPermission;
void runtimeAuthSubject;
void runtimeAuthenticatedSession;
void runtimeWebPrincipalSession;
void runtimeWebPrincipalSummary;
void runtimeWebPrincipalBootstrapPayload;
void runtimeApprovedRecord;
void rootObjectViewRoundTrip;
void rootWorkflowRoundTrip;
void rootCommandRoundTrip;
void rootReadPermissionRoundTrip;
void rootSavePermissionRoundTrip;
void rootBlobPermissionRoundTrip;
void rootAuthSubjectRoundTrip;
void rootAuthenticatedSessionRoundTrip;
void rootWebPrincipalSessionRoundTrip;
void rootWebPrincipalSummaryRoundTrip;
void rootWebPrincipalBootstrapPayloadRoundTrip;
void rootApprovedRecordRoundTrip;
