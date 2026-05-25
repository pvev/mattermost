DO $$
BEGIN
    IF to_regclass('accesscontroltemporaryaccesses') IS NULL AND to_regclass('accesscontrolbypasses') IS NOT NULL THEN
        ALTER TABLE AccessControlBypasses RENAME TO AccessControlTemporaryAccesses;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('idx_accesscontroltemporaryaccesses_activelookup') IS NULL AND to_regclass('idx_accesscontrolbypasses_activelookup') IS NOT NULL THEN
        ALTER INDEX IDX_AccessControlBypasses_ActiveLookup RENAME TO IDX_AccessControlTemporaryAccesses_ActiveLookup;
    END IF;
    IF to_regclass('idx_accesscontroltemporaryaccesses_resource') IS NULL AND to_regclass('idx_accesscontrolbypasses_resource') IS NOT NULL THEN
        ALTER INDEX IDX_AccessControlBypasses_Resource RENAME TO IDX_AccessControlTemporaryAccesses_Resource;
    END IF;
    IF to_regclass('idx_accesscontroltemporaryaccesses_subject') IS NULL AND to_regclass('idx_accesscontrolbypasses_subject') IS NOT NULL THEN
        ALTER INDEX IDX_AccessControlBypasses_Subject RENAME TO IDX_AccessControlTemporaryAccesses_Subject;
    END IF;
    IF to_regclass('idx_accesscontroltemporaryaccesses_expiresat_deleteat') IS NULL AND to_regclass('idx_accesscontrolbypasses_expiresat_deleteat') IS NOT NULL THEN
        ALTER INDEX IDX_AccessControlBypasses_ExpiresAt_DeleteAt RENAME TO IDX_AccessControlTemporaryAccesses_ExpiresAt_DeleteAt;
    END IF;
END $$;

ALTER TABLE AccessControlTemporaryAccesses
    ADD COLUMN IF NOT EXISTS TeamMembershipCreated bool NOT NULL DEFAULT false;
