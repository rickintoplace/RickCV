# RickCV - Dynamic Resume & Cover Letter Template
     _____  _      _     _______      __
    |  __ \(_)    | |   / ____\ \    / /
    | |__) |_  ___| | _| |     \ \  / / 
    |  _  /| |/ __| |/ / |      \ \/ /  
    | | \ \| | (__|   <| |____   \  /   
    |_|  \_\_|\___|_|\_\\_____|   \/  [rɪk-si-vi]
    A dynamic template for your resume and cover letter

See an example in action at codesandbox: https://hw8733.csb.app/

Welcome to **RickCV** – a dynamic template designed to create customizable and professional resumes and cover letters. This project is built using HTML, CSS, and JavaScript, offering a clean, modern layout that is fully adjustable for your needs. It also includes features to optimize your resume for Applicant Tracking Systems (ATS), making it easy to tailor your content for both human and machine readers.

## Preview

<p align="center">
<img src="https://github.com/rickintoplace/RickCV/blob/main/examples/preview1.png?raw=true" width="500">
<img src="https://github.com/rickintoplace/RickCV/blob/main/examples/preview2.png?raw=true" width="500">
</p>

Two A4 pages are generated and saved as a PDF file that can be read by both people and machines.

## Features

- **Dynamic Content:** Easily adjust your resume's layout, profile, and contact details, along with other sections like languages, skills, education, and projects.
- **ATS-Friendly:** Optionally activate an ATS-compatible format for better readability and data extraction.
- **Multiple Layouts:** Choose from different layouts to fit your personal style, including 'clean', 'icons', and 'dynaline'.
- **Customizable Styling:** Fully customizable color themes, fonts, margins, and profile image options.
- **Export to PDF:** Export your finalized resume and cover letter as a PDF for easy printing or sharing.

### Dynamically change the color
![color changes](https://github.com/rickintoplace/RickCV/blob/main/examples/dynamic%20accent%20color.png?raw=true)

### Customize icons, sections, timeline and chronology
<p align="center">
<img src="https://github.com/rickintoplace/RickCV/blob/main/examples/example%20dynaline.png?raw=true" width="500">
<img src="https://github.com/rickintoplace/RickCV/blob/main/examples/example%20%20icons.png?raw=true" width="500">
</p>

## How to Use

Follow these steps to customize and export your resume and cover letter:

### 1. Clone the Repository:
Download or clone the repository to your local machine using the following command:
```bash
git clone https://github.com/rickintoplace/RickCV.git
```
### 2. Install Dependencies

While RickCV is simple to run, I recommend using **Visual Studio Code** (VSCode) for editing. Additionally, install the **Live Server** extension for a seamless development experience. This extension will allow you to see live updates in your browser as you make changes to the code.

### 3. Edit Your Data

- Open the project folder in VSCode.
- Navigate to the `index.mjs` file. This file contains all the customizable data:
  - **Profile Text**: Modify the profile description under the `profileText` variable.
  - **Contact Info**: Adjust your personal details like name, email, phone, etc., within the `contactInfo` object.
  - **Languages & Skills**: Customize your language proficiency and skill levels.
  - **Experience & Education**: Edit the `events` array to reflect your work experience, education, and volunteer work.

### 4. Choose Layout & Style

- Customize the layout by changing the `template` variable to one of the following options: `'clean'`, `'icons'`, or `'dynaline'`.
- Adjust the colors and fonts by editing the `styles.css` file. You can modify the root variables like `--accent-color`, `--font-color`, and others to match your personal preferences.

### 5. Preview Your Resume

- After saving your changes, right-click the `index.html` file and select "Open with Live Server" from the context menu in VSCode.
- The file will open in your default browser (preferably **Google Chrome**, as the layout is optimized for it). This will show a live preview of your resume.

### 6. Export as PDF

- Once you’re satisfied with the design and content, press `Ctrl + P` (or `Cmd + P` on Mac) in Chrome and select "Save as PDF."
- Save your resume and cover letter as a PDF file for easy sharing or printing.

## Additional Configuration

Here are some optional customizations that you can make to further personalize your resume:

- **ATS Compatibility**: Set `activateATS = 1` to enable the ATS-friendly format. This will structure your resume with machine-readable data, ensuring better compatibility with automated systems.
- **Profile Image**: You can upload a custom profile image by modifying the `profileImage` URL in `index.mjs`.
- **Interest & Projects**: Showcase your hobbies or relevant projects by editing the `interests` and `projects` arrays.

## Example Customizations

1. **Change Template Layout**

   To switch to a different layout, modify the `template` variable in `index.mjs`:

   ```javascript
   let template = "icons"; // Switch to 'icons' layout
   ```
   
2. **Update Contact Information**

   Modify the contact section to display your personal details:

   ```javascript
   let contactInfo = {
     name: "Max Mustermann",
     role: "Softwareentwickler",
     address: "Musterstraße 1",
     city: "12345 Musterstadt",
     email: "max@mustermann.de",
     phone: "+49 123 456789"
   };
   ```

2. **Add a New Skill**

   To add a new skill or update an existing one, modify the `skills` array in `index.mjs`.
   
3. **Modify Interests**

   If you'd like to display different interests, simply modify the `interests` array in `index.mjs`. You can use any icon or symbol from here: https://fonts.google.com/icons

## Technologies Used

- **HTML5** - For structuring the resume and cover letter content.
- **CSS3** - For styling the layout, including responsive design and custom themes.
- **JavaScript (ES6)** - For dynamic content rendering and customization features.
- **Google Fonts** - Used for icons and fonts (e.g., Material Icons).

## Contributing

If you’d like to contribute to the development of RickCV, feel free to fork the repository, make your changes, and create a pull request. I welcome any improvements or new features that could enhance this template.

## License

The MIT license, with the following restriction:

- **Commercial use** of this code or derivative works is permitted only with express written permission of the author.




