ALTER TABLE AccessControlBypasses
    ADD COLUMN IF NOT EXISTS TeamMembershipCreated bool NOT NULL DEFAULT false;
ALTER TABLE AccessControlTemporaryAccesses
    ADD COLUMN IF NOT EXISTS TeamMembershipCreated bool NOT NULL DEFAULT false;
