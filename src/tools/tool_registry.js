/**
 * Aetheria Tool Registry
 * Defines tool definitions, JSON schemas, and execution metadata for the ReAct loop.
 */

export const TOOL_DEFINITIONS = [
  {
    name: 'click_element',
    description: 'Clicks an interactive element on the current webpage using its numbered badge ID (e.g. 1, 5, 12).',
    parameters: {
      type: 'object',
      properties: {
        element_id: {
          type: 'number',
          description: 'The numeric ID of the element to click (e.g. 3 for badge #3).'
        }
      },
      required: ['element_id']
    }
  },
  {
    name: 'fill_form_field',
    description: 'Types text into a form input, search bar, textarea, or contenteditable field by element ID.',
    parameters: {
      type: 'object',
      properties: {
        element_id: {
          type: 'number',
          description: 'The numeric ID of the input/textarea.'
        },
        value: {
          type: 'string',
          description: 'The exact text value to type into the field.'
        }
      },
      required: ['element_id', 'value']
    }
  },
  {
    name: 'select_dropdown_option',
    description: 'Selects an option inside a dropdown (<select>) element.',
    parameters: {
      type: 'object',
      properties: {
        element_id: {
          type: 'number',
          description: 'The numeric ID of the select element.'
        },
        option_value: {
          type: 'string',
          description: 'The value or visible text of the option to select.'
        }
      },
      required: ['element_id', 'option_value']
    }
  },
  {
    name: 'upload_resume_file',
    description: 'Uploads the user’s active resume file into an <input type="file"> element on the application form.',
    parameters: {
      type: 'object',
      properties: {
        element_id: {
          type: 'number',
          description: 'The numeric ID of the file input element.'
        }
      },
      required: ['element_id']
    }
  },
  {
    name: 'scroll_page',
    description: 'Scrolls the current webpage up or down to reveal more content or elements.',
    parameters: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['up', 'down'],
          description: 'Direction to scroll.'
        },
        amount: {
          type: 'number',
          description: 'Pixel amount to scroll (default: 450).'
        }
      },
      required: ['direction']
    }
  },
  {
    name: 'navigate_to_url',
    description: 'Navigates the current browser tab to a specified destination URL.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL to navigate to (e.g. https://www.linkedin.com/jobs).'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'fetch_link_content',
    description: 'Fetches and extracts clean readable text from a URL in the background without leaving the current tab.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL of the page or job listing to read.'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'wait_seconds',
    description: 'Waits for a specified number of seconds for page transitions, modals, or AJAX calls to settle.',
    parameters: {
      type: 'object',
      properties: {
        seconds: {
          type: 'number',
          description: 'Duration in seconds to wait (1 to 10).'
        }
      },
      required: ['seconds']
    }
  },
  {
    name: 'ask_user',
    description: 'Pauses the autonomous ReAct loop to ask the human user a question, clarification, confirmation, or missing information (e.g. custom essay question, CAPTCHA solved confirmation). Execution resumes immediately when the user replies.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The clear question or prompt for the user.'
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of quick-reply choices (e.g. ["Yes, proceed", "No, skip", "Use standard answer"]).'
        }
      },
      required: ['question']
    }
  },
  {
    name: 'finish_task',
    description: 'Marks the user task as completely finished and provides a comprehensive executive summary of what was accomplished.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Detailed final summary of actions taken, jobs applied to, or data extracted.'
        }
      },
      required: ['summary']
    }
  }
];
