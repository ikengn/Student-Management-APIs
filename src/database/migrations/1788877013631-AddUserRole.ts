import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserRole1788877013631 implements MigrationInterface {
    name = 'AddUserRole1788877013631'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "role" character varying(255) NOT NULL DEFAULT 'user'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    }

}
