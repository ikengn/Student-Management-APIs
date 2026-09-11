import { IsString, IsEmail, IsDateString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateStudentDto {
  @IsString()
  @IsOptional()
  readonly name?: string;

  @IsEmail()
  @IsOptional()
  readonly email?: string;

  @IsDateString()
  @IsOptional()
  readonly dateOfBirth?: Date;
}
