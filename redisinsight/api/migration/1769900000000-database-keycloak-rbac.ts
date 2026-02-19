import { MigrationInterface, QueryRunner } from 'typeorm';

export class DatabaseKeycloakRbac1769900000000 implements MigrationInterface {
  name = 'DatabaseKeycloakRbac1769900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "database_instance" ADD COLUMN "allowedGroups" varchar NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "database_instance" ADD COLUMN "allowedRoles" varchar NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "database_instance" DROP COLUMN "allowedRoles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "database_instance" DROP COLUMN "allowedGroups"`,
    );
  }
}
