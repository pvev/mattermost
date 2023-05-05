SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'WorkTemplateResult'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Channels ADD COLUMN WorkTemplateResult JSON;'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
