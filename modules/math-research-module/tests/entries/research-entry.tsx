import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ResearchProblem} from '../../src/components/generated/ResearchProblem';
import {RESEARCH_DESIGNS} from '../../src/components/generated/ResearchData';
const root=createRoot(document.getElementById('root')!);
(window as any).flush=flushSync;
(window as any).designs=RESEARCH_DESIGNS;
(window as any).renderResearch=(id:string)=>flushSync(()=>root.render(<ResearchProblem key={id} typeId={id}/>));
