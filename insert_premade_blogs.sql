-- ============================================================================
-- PREMADE BLOG POSTS (Execute in Supabase SQL Editor)
-- This will add the 3 exact blog posts from your design to the database.
-- ============================================================================

-- 1. Ensure the 'category' column exists in the posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS category TEXT;

-- 2. Insert the premade blogs
INSERT INTO public.posts (title, category, excerpt, content, slug, views) 
VALUES 
(
  'The Future of Strategic Finance: AI-Driven Insights',
  'FINANCE',
  'How AI and Machine Learning are transforming traditional FP&A into a powerhouse of predictive insights.',
  '<p>The integration of Artificial Intelligence in Strategic Finance is no longer a future concept—it is happening now. We are moving from reactive reporting to proactive predictive analytics. Financial Planning & Analysis (FP&A) teams are leveraging machine learning to automate data aggregation and uncover hidden trends.</p>',
  'future-of-strategic-finance',
  0
),
(
  'Building Agentic Workflows with Large Language Models',
  'AI',
  'Moving beyond simple chatbots: How to design autonomous AI agents that can use tools and execute complex tasks.',
  '<p>Agentic workflows represent the next paradigm in artificial intelligence. Instead of merely answering questions, Large Language Models (LLMs) are now being equipped with tools to execute complex, multi-step tasks autonomously. Designing these workflows requires a deep understanding of state management and dynamic prompting.</p>',
  'building-agentic-workflows',
  0
),
(
  'Quantitative Analysis for Personal Portfolios',
  'QUANT',
  'Applying institutional-grade quantitative methods to manage your personal investment portfolio using Python.',
  '<p>Retail investors now have access to the same computational tools that quantitative hedge funds use. By utilizing Python libraries such as Pandas and NumPy, you can backtest trading strategies, analyze risk-adjusted returns, and optimize asset allocation for your personal portfolio.</p>',
  'quantitative-analysis-personal-portfolios',
  0
);
