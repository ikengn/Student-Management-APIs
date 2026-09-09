import { IsString, IsEmail, IsDate, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  readonly name: string;

  @IsEmail()
  @IsNotEmpty()
  readonly email: string;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  readonly dateOfBirth: Date;
}
