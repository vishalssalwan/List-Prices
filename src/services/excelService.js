import axios from 'axios';
import * as XLSX from 'xlsx';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQuIU5ubtIXwz-j3TdBPeopdklMf567ywXY_tm63dxZIWRAobgDXEbpp5CR6ps55gMeXwT4nAZMlEmf/pub?output=xlsx";

export const fetchSheetData = async () => {
  try {
    const response = await axios.get(SHEET_URL, { responseType: 'arraybuffer' });
    const data = new Uint8Array(response.data);
    const workbook = XLSX.read(data, { type: 'array' });
    return workbook;
  } catch (err) {
    console.error("Error in excelService:", err);
    throw new Error('Failed to fetch from Google Sheets.');
  }
};
