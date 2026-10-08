import { Global, Module } from '@nestjs/common';
import { ANSWERER, EMBEDDER } from './ai.types';
import { LocalAnswerer, LocalEmbedder } from './local';
import { OpenAIAnswerer, OpenAIEmbedder } from './openai';

const useOpenAI = () => process.env.AI_PROVIDER === 'openai';

@Global()
@Module({
  providers: [
    {
      provide: EMBEDDER,
      useFactory: () => (useOpenAI() ? new OpenAIEmbedder() : new LocalEmbedder()),
    },
    {
      provide: ANSWERER,
      useFactory: () => (useOpenAI() ? new OpenAIAnswerer() : new LocalAnswerer()),
    },
  ],
  exports: [EMBEDDER, ANSWERER],
})
export class AiModule {}
