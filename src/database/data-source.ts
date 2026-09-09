import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from './entities/user.entity.js';
import { Student } from './entities/student.entity.js';
import { Course } from './entities/course.entity.js';
import { Enrollment } from './entities/enrollment.entity.js';

ConfigModule.forRoot();
const configService = new ConfigService();

export const dataSourceOptions: DataSourceOptions = {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'studentmgr'),
    password: configService.get<string>('DB_PASSWORD', 'studentmgr'),
    database: configService.get<string>('DB_NAME', 'studentmgr'),
    entities: [User, Student, Course, Enrollment],
    migrations: ['dist/database/migrations/*.js'],
    synchronize: false,
};

export default new DataSource(dataSourceOptions);