import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ActionExplorer} from '../../src/components/generated/ActionExplorer';
import sample from '../../source/archive/grade3_research/freudenthal/action_microsteps_sample_division.json';
const root=createRoot(document.getElementById('root')!);
(window as any).flush=flushSync;
(window as any).sample=sample;
flushSync(()=>root.render(<ActionExplorer design={sample} scope="grade3_core"/>));
