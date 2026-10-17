import { createRoot } from 'react-dom/client';
import { ReferenceApp } from './ReferenceApp';


const root = document.getElementById('root');
if (!root) throw new Error('Missing UI root');
createRoot(root).render(<ReferenceApp />);
