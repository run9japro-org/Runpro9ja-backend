import server from './app.js';   // notice: now importing server, not app
import { connectDB } from './src/config/db.js';
import { env } from './src/config/env.js';

const bootstrap = async () => {
  await connectDB();
  server.listen(env.port, () => {
    console.log(`🚀 Server running on http://localhost:${env.port}`);
  });
};

bootstrap();
