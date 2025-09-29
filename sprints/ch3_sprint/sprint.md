# **Project Overview**

## **Application Vision/Goal:**
The purpose of this application is to give users the ability to trade (barter) real life items rather than using money. This facilitates the gift economy and gives a platform to people who want to trade real life items (Like pokemon cards). Our project is marketed to broke college kids, middle aged parents, and Gen X who use NextDoor or Buy Nothing Facebook groups.

## **Scope:**
Ability for users to login and safely connect with users within a radius. Users can upload, delete, offer, reject, and accept trades for items. 

## **Deliverables:**
 working application where users can login, upload, and initiate trades. Well documented code with a simple concrete stack. 

## **Success Criteria:**
A working application by the end of the semester, safety for the users in the application, each sprint completed relatively on time where progress is made weekly.

## **Risks:**
Security, legality, malpractice lawsuit, malicious actors. People selling fake items or potentially harmful content

## **Design / Architectural Review:**
We are usign a blend of monolithic and micro-service architecture because our C# back-end and React front-end are not explicitly micro-serviced. Our back-end is monolithic since we are limiting our features. We will use a Postgres database to store users and trades. 

## **Test Environment:**
We will use Jest as well as React-Testing-Library for front-end testing. For the backend we will write our own tests to ensure type safety and logical completion.

---

# **Team Setup**

# **Team Members:**
Richard Zielenski, Xavier Wallis, Daniel Beiser

## **Team Roles:** 
Xavier Wallis - Team Lead, Contributing to full stack development
Daniel Beiser - Front-end dev
Richard Zielenski - Back-end dev
*subject to change*

## **Team Norms:**
Communicating through text and discord, scheduling meetings on a need to meet basis (also in class meetings)

## **Application Stack:**
React front-end with vite as a build tool, C# backend with Postgres Database

### **Libraries/Frameworks
React, Vite, JsonWebToken, Tailwind
