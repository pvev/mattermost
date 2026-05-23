CREATE TABLE IF NOT EXISTS AccessControlBypasses (
    Id varchar(26) PRIMARY KEY,
    SubjectType varchar(64) NOT NULL,
    SubjectId varchar(26) NOT NULL,
    ResourceType varchar(64) NOT NULL,
    ResourceId varchar(26) NOT NULL,
    Action varchar(128) NOT NULL,
    Reason varchar(1024) NOT NULL,
    InviteMode varchar(32) NOT NULL DEFAULT 'none',
    AcceptedAt bigint NOT NULL DEFAULT 0,
    JoinedAt bigint NOT NULL DEFAULT 0,
    MembershipCreated bool NOT NULL DEFAULT false,
    CreateAt bigint NOT NULL,
    UpdateAt bigint NOT NULL,
    ExpiresAt bigint NOT NULL,
    DeleteAt bigint NOT NULL DEFAULT 0,
    CreatedBy varchar(26) NOT NULL,
    DeletedBy varchar(26)
);

CREATE INDEX IF NOT EXISTS IDX_AccessControlBypasses_ActiveLookup
    ON AccessControlBypasses (SubjectType, SubjectId, ResourceType, ResourceId, Action, ExpiresAt)
    WHERE DeleteAt = 0;

CREATE INDEX IF NOT EXISTS IDX_AccessControlBypasses_Resource
    ON AccessControlBypasses (ResourceType, ResourceId, CreateAt);

CREATE INDEX IF NOT EXISTS IDX_AccessControlBypasses_Subject
    ON AccessControlBypasses (SubjectType, SubjectId, CreateAt);

CREATE INDEX IF NOT EXISTS IDX_AccessControlBypasses_ExpiresAt_DeleteAt
    ON AccessControlBypasses (ExpiresAt, DeleteAt);
