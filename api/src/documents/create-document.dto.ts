import { IsString, Length } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsString()
  @Length(1, 500_000) // about 100 pages of text
  content: string;
}
