import { IsString, IsEmail, IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateStudentDto {
  @IsString()
  @IsOptional()
  readonly name?: string;

  @IsEmail()
  @IsOptional()
  readonly email?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  readonly dateOfBirth?: Date;
}
