DO $$
BEGIN
    IF to_regclass('idx_accesscontrolbypasses_activelookup') IS NULL AND to_regclass('idx_accesscontroltemporaryaccesses_activelookup') IS NOT NULL THEN
        ALTER INDEX IDX_AccessControlTemporaryAccesses_ActiveLookup RENAME TO IDX_AccessControlBypasses_ActiveLookup;
    END IF;
    IF to_regclass('idx_accesscontrolbypasses_resource') IS NULL AND to_regclass('idx_accesscontroltemporaryaccesses_resource') IS NOT NULL THEN
        ALTER INDEX IDX_AccessControlTemporaryAccesses_Resource RENAME TO IDX_AccessControlBypasses_Resource;
    END IF;
    IF to_regclass('idx_accesscontrolbypasses_subject') IS NULL AND to_regclass('idx_accesscontroltemporaryaccesses_subject') IS NOT NULL THEN
        ALTER INDEX IDX_AccessControlTemporaryAccesses_Subject RENAME TO IDX_AccessControlBypasses_Subject;
    END IF;
    IF to_regclass('idx_accesscontrolbypasses_expiresat_deleteat') IS NULL AND to_regclass('idx_accesscontroltemporaryaccesses_expiresat_deleteat') IS NOT NULL THEN
        ALTER INDEX IDX_AccessControlTemporaryAccesses_ExpiresAt_DeleteAt RENAME TO IDX_AccessControlBypasses_ExpiresAt_DeleteAt;
    END IF;

    IF to_regclass('accesscontrolbypasses') IS NULL AND to_regclass('accesscontroltemporaryaccesses') IS NOT NULL THEN
        ALTER TABLE AccessControlTemporaryAccesses RENAME TO AccessControlBypasses;
    END IF;
END $$;
