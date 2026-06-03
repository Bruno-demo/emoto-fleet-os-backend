import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ContactInquiryDto {
  @ApiProperty({
    description: 'Full name of the inquirer',
    example: 'Jean Damascene',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Email address of the inquirer',
    example: 'jean@company.rw',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'Topic or category of the inquiry',
    example: 'general',
  })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty({
    description: 'The inquiry message content',
    example: 'I would like to request a demo account for my fleet of 20 bikes.',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;
}
