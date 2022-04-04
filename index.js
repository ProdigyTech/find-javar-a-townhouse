import puppeteer from "puppeteer";
import nodemailer from "nodemailer";

const earliestMoveInDate = new Date("5/30/2022");
const latestMoveInDate = new Date("7/15/2022");

const generateTownhouseEmailTemplate = ({
  address,
  bedroom,
  bathroom,
  squareFeet,
  lowestPricePerMoveInDate,
  floorPlan,
}) => {
  return `\n There is a ${squareFeet} sqft ${bedroom} Bedroom, ${bathroom} Bathroom Townhouse Located @ ${address.addressLine1} with the following best terms: 
                Date Available: ${lowestPricePerMoveInDate.date} 
                Lease Term:  ${lowestPricePerMoveInDate.termLength} Months
                Rent: $${lowestPricePerMoveInDate.price} 
                net effective price (promotions) : $${lowestPricePerMoveInDate.netEffectivePrice} 
            
                Link to floorplan image: https://resource.avalonbay.com${floorPlan.highResolution}

                ----------------------------------------------------------------------------------------------`;
};

const launchBrowser = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(
    "https://new.avaloncommunities.com/virginia/arlington-apartments/avalon-at-arlington-square/#community-unit-listings"
  );

  const data = await page.evaluate(() => {
    return window.Fusion.globalContent.units || [];
  });
  await browser.close();
  return data;
};

const sendNotification = (filteredEntries) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS,
    },
  });

  const attachments = filteredEntries.map((data, i) => {
    return {
      filename: data.floorPlan.lowResolution.split("/128/96")[0],
      path: `https://resource.avalonbay.com/${
        data.floorPlan.lowResolution.split("/128/96")[0]
      }`,
      cid: `photo-${i}`,
    };
  });
  const mailOptions = {
    from: process.env.EMAIL,
    to: process.env.EMAIL,
    subject: `ALERT ---- (${filteredEntries.length}) New Townhouses Available!`,
    attachments: attachments,
    text: `Here are the listing below: 
    ${filteredEntries.map((args, i) => {
      return generateTownhouseEmailTemplate(args, i);
    })}`,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};

const townhouseData = await launchBrowser();

const filteredTownhouseData = townhouseData.filter(
  ({
    bedroom,
    bathroom,
    squareFeet,
    floorPlan,
    characteristics = [],
    lowestPricePerMoveInDate,
  }) => {
    if (characteristics[0] == "Townhome" && bedroom >= 2 && squareFeet > 1200) {
      const moveInDate = new Date(lowestPricePerMoveInDate.date);
      if (earliestMoveInDate <= moveInDate && latestMoveInDate >= moveInDate) {
        return {
          bedroom,
          bathroom,
          squareFeet,
          floorPlan,
          characteristics,
          lowestPricePerMoveInDate,
        };
      }
    }
  }
);

if (filteredTownhouseData.length) {
  sendNotification(filteredTownhouseData);
}
