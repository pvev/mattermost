ALTER TABLE AccessControlBypasses
    DROP COLUMN IF EXISTS TeamMembershipCreated;
ALTER TABLE AccessControlTemporaryAccesses
    DROP COLUMN IF EXISTS TeamMembershipCreated;
